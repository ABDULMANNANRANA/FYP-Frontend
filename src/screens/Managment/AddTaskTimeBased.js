import React, { useEffect, useState } from 'react';
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
  Modal,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@react-native-vector-icons/ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { BASE_URL } from '../../config/api';

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

  const [groupMembers, setGroupMembers] = useState([]);
  const [selectedMentionMembers, setSelectedMentionMembers] = useState([]);
  const [showMentionModal, setShowMentionModal] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  const groupIdParam = route?.params?.groupId || null;

  const primaryColor = theme.primary || '#2563EB';
  const cardBg = theme.card || '#FFFFFF';
  const textColor = theme.text || '#0F172A';
  const subTextColor = theme.subText || '#64748B';
  const borderClr = theme.border || '#E2E8F0';

  const inputBg =
    theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

  const goToLogin = async () => {
    await AsyncStorage.removeItem('token');

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

  const parseResponse = async (response) => {
    const text = await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return {
        message: text,
      };
    }
  };

  const getTaskIdFromResponse = (data) => {
    return (
      data?.data?.id ??
      data?.data?.taskId ??
      data?.taskId ??
      data?.id ??
      null
    );
  };

  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!groupIdParam) {
        setGroupMembers([]);
        return;
      }

      try {
        setMembersLoading(true);

        const token = await AsyncStorage.getItem('token');

        if (!token) {
          return;
        }

        const response = await fetch(`${BASE_URL}/Task/groups`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          await goToLogin();
          return;
        }

        const data = await parseResponse(response);

        if (!response.ok) {
          console.log(
            'Failed to fetch group members:',
            data?.message
          );
          return;
        }

        const groupsData = Array.isArray(data?.data)
          ? data.data
          : [];

        const currentGroup = groupsData.find(
          (group) =>
            String(group?.id ?? group?.groupId) ===
            String(groupIdParam)
        );

        const members = Array.isArray(currentGroup?.members)
          ? currentGroup.members
          : [];

        const normalizedMembers = members
          .map((member) => {
            const userId =
              member?.userId ??
              member?.id ??
              member?.UserId ??
              null;

            const firstName =
              member?.firstName ??
              member?.FirstName ??
              '';

            const lastName =
              member?.lastName ??
              member?.LastName ??
              '';

            const displayName =
              member?.displayName ??
              member?.name ??
              member?.fullName ??
              `${firstName} ${lastName}`.trim();

            return {
              ...member,

              userId:
                userId !== null
                  ? Number(userId)
                  : null,

              displayName:
                displayName ||
                member?.phone ||
                member?.PhoneNumber ||
                'Group Member',

              phone:
                member?.phone ??
                member?.PhoneNumber ??
                '',

              isRegistered:
                member?.isRegistered !== false &&
                userId !== null &&
                Number(userId) > 0,
            };
          })
          .filter(
            (member) =>
              member.isRegistered &&
              Number(member.userId) > 0
          );

        setGroupMembers(normalizedMembers);
      } catch (error) {
        console.log(
          'Error fetching group members:',
          error
        );
      } finally {
        setMembersLoading(false);
      }
    };

    fetchGroupMembers();
  }, [groupIdParam]);

  const onChangeDate = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDate(false);
    }

    if (selectedDate) {
      const newDate = new Date(date);

      newDate.setFullYear(
        selectedDate.getFullYear()
      );

      newDate.setMonth(
        selectedDate.getMonth()
      );

      newDate.setDate(
        selectedDate.getDate()
      );

      setDate(newDate);
    }
  };

  const onChangeTime = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTime(false);
    }

    if (selectedTime) {
      const newDate = new Date(date);

      newDate.setHours(
        selectedTime.getHours()
      );

      newDate.setMinutes(
        selectedTime.getMinutes()
      );

      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      setDate(newDate);
    }
  };

  const formatDueDate = (d) => {
    const year = d.getFullYear();
    const month = String(
      d.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      d.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const formatDueTime = (d) => {
    const hours = String(
      d.getHours()
    ).padStart(2, '0');

    const minutes = String(
      d.getMinutes()
    ).padStart(2, '0');

    const seconds = String(
      d.getSeconds()
    ).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  };

  const toggleMentionMember = (member) => {
    if (!member?.userId) {
      return;
    }

    const memberId = Number(member.userId);

    setSelectedMentionMembers((previous) => {
      const alreadySelected = previous.some(
        (selectedMember) =>
          Number(selectedMember.userId) === memberId
      );

      if (alreadySelected) {
        return previous.filter(
          (selectedMember) =>
            Number(selectedMember.userId) !== memberId
        );
      }

      return [...previous, member];
    });
  };

  const clearAllMentions = () => {
    setSelectedMentionMembers([]);
  };

  const isMemberSelected = (member) => {
    if (!member?.userId) {
      return false;
    }

    return selectedMentionMembers.some(
      (selectedMember) =>
        Number(selectedMember.userId) ===
        Number(member.userId)
    );
  };

  const mentionUsers = async (
    taskId,
    members,
    token
  ) => {
    if (!taskId) {
      return {
        success: false,
        message: 'Task ID was not returned by the server.',
      };
    }

    const mentionedUserIds = Array.from(
      new Set(
        (Array.isArray(members) ? members : [])
          .map((member) =>
            Number(member?.userId)
          )
          .filter(
            (userId) =>
              Number.isInteger(userId) &&
              userId > 0
          )
      )
    );

    try {
      const response = await fetch(
        `${BASE_URL}/Task/${taskId}/mention`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mentionedUserIds,
          }),
        }
      );

      if (response.status === 401) {
        await goToLogin();

        return {
          success: false,
          message: 'Session expired.',
        };
      }

      const data = await parseResponse(response);

      console.log(
        'Mention API Status:',
        response.status
      );

      console.log(
        'Mention API Request:',
        {
          mentionedUserIds,
        }
      );

      console.log(
        'Mention API Response:',
        data
      );

      if (!response.ok || !data?.success) {
        return {
          success: false,
          message:
            data?.message ||
            `Failed to process mentions. HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: Array.isArray(data?.data)
          ? data.data
          : [],
        message:
          data?.message ||
          (
            mentionedUserIds.length === 0
              ? 'No members were selected for mention.'
              : 'Members mentioned successfully.'
          ),
        alreadyMentionedUserIds:
          Array.isArray(
            data?.alreadyMentionedUserIds
          )
            ? data.alreadyMentionedUserIds
            : [],
      };
    } catch (error) {
      console.log(
        'Mention Users Error:',
        error
      );

      return {
        success: false,
        message:
          error?.message ||
          'Unable to process mentions.',
      };
    }
  };

  const getTaskMentions = async (
    taskId,
    token
  ) => {
    if (!taskId) {
      return [];
    }

    try {
      const response = await fetch(
        `${BASE_URL}/Task/${taskId}/mentions`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        await goToLogin();
        return [];
      }

      const data = await parseResponse(response);

      console.log(
        'Get Mentions Status:',
        response.status
      );

      console.log(
        'Get Mentions Response:',
        data
      );

      if (response.ok && data?.success) {
        return Array.isArray(data?.data)
          ? data.data
          : [];
      }

      return [];
    } catch (error) {
      console.log(
        'Get Task Mentions Error:',
        error
      );

      return [];
    }
  };

  const AddTask = async () => {
    if (!title.trim()) {
      Alert.alert(
        'Error',
        'Please enter task title.'
      );
      return;
    }

    if (!description.trim()) {
      Alert.alert(
        'Error',
        'Please enter task description.'
      );
      return;
    }

    const token =
      await AsyncStorage.getItem('token');

    if (!token) {
      Alert.alert(
        'Session Expired',
        'Please login again.',
        [
          {
            text: 'OK',
            onPress: goToLogin,
          },
        ]
      );

      return;
    }

    try {
      setLoading(true);

      const formattedDate =
        formatDueDate(date);

      const formattedTime =
        formatDueTime(date);

      const response = await fetch(
        `${BASE_URL}/Managment/task`,
        {
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
            groupId: groupIdParam
              ? parseInt(groupIdParam, 10)
              : null,
          }),
        }
      );

      if (response.status === 401) {
        await goToLogin();
        return;
      }

      const responseData =
        await parseResponse(response);

      console.log(
        'Create Task Response Status:',
        response.status
      );

      console.log(
        'Create Task Response Body:',
        responseData
      );

      if (
        !response.ok ||
        !(
          responseData?.success ||
          response.status === 200 ||
          response.status === 201
        )
      ) {
        Alert.alert(
          'Error',
          responseData?.message ||
            `Failed to create task (HTTP ${response.status}).`
        );

        return;
      }

      const createdTaskId =
        getTaskIdFromResponse(
          responseData
        );

      if (!createdTaskId) {
        if (
          selectedMentionMembers.length > 0
        ) {
          Alert.alert(
            'Task Created',
            'The task was created successfully, but the task ID was not returned by the server, so the selected members could not be mentioned.',
            [
              {
                text: 'OK',
                onPress: () =>
                  navigation.goBack(),
              },
            ]
          );

          return;
        }

        Alert.alert(
          'Success',
          responseData?.message ||
            'Task created successfully.',
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.goBack(),
            },
          ]
        );

        return;
      }

      let mentionResult = null;

      if (groupIdParam) {
        mentionResult = await mentionUsers(
          createdTaskId,
          selectedMentionMembers,
          token
        );

        if (mentionResult.success) {
          const verifiedMentions =
            await getTaskMentions(
              createdTaskId,
              token
            );

          console.log(
            'Verified task mentions:',
            verifiedMentions
          );
        }
      }

      if (
        mentionResult &&
        !mentionResult.success
      ) {
        Alert.alert(
          'Task Created',
          `Task was created successfully, but the mentions could not be processed.\n\n${mentionResult.message}`,
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.goBack(),
            },
          ]
        );

        return;
      }

      let successMessage =
        responseData?.message ||
        'Task created successfully.';

      if (groupIdParam) {
        const selectedCount =
          selectedMentionMembers.length;

        if (selectedCount === 0) {
          successMessage +=
            '\n\nNo members were mentioned.';
        } else if (selectedCount === 1) {
          successMessage +=
            `\n\n${selectedMentionMembers[0].displayName} was mentioned successfully.`;
        } else {
          successMessage +=
            `\n\n${selectedCount} group members were mentioned successfully.`;
        }
      }

      Alert.alert(
        'Success',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.goBack(),
          },
        ]
      );

      setTitle('');
      setDescription('');
      setDate(new Date());
      setSelectedMentionMembers([]);
    } catch (error) {
      console.log(
        'Add Task Error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Server not reachable.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNonTimeBased = () => {
    setTaskType('non');

    navigation.navigate(
      'AddTaskNonTimeBased',
      {
        groupId: groupIdParam,
      }
    );
  };


  const handleLocationBased = () => {
    const params = {};

    if (groupIdParam) {
      params.groupId = Number(groupIdParam);
    }

    navigation.navigate('AddTaskLocationBased', params);
  };

  const renderMentionModal = () => {
    return (
      <Modal
        visible={showMentionModal}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowMentionModal(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: cardBg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={styles.modalTitleContainer}
              >
                <Icon
                  name="at-outline"
                  size={22}
                  color={primaryColor}
                />

                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: textColor,
                    },
                  ]}
                >
                  Mention Group Members
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowMentionModal(false)
                }
                style={[
                  styles.modalCloseButton,
                  {
                    backgroundColor: inputBg,
                  },
                ]}
              >
                <Icon
                  name="close"
                  size={20}
                  color={textColor}
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.selectionHeader
              }
            >
              <Text
                style={[
                  styles.modalSubtitle,
                  {
                    color: subTextColor,
                  },
                ]}
              >
                Select zero, one, or multiple
                registered group members.
              </Text>

              {selectedMentionMembers.length >
                0 && (
                <TouchableOpacity
                  onPress={
                    clearAllMentions
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.clearAllText,
                      {
                        color: '#EF4444',
                      },
                    ]}
                  >
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.selectedCountBox,
                {
                  backgroundColor: `${primaryColor}10`,
                  borderColor: `${primaryColor}30`,
                },
              ]}
            >
              <Icon
                name="people-outline"
                size={18}
                color={primaryColor}
              />

              <Text
                style={[
                  styles.selectedCountText,
                  {
                    color: primaryColor,
                  },
                ]}
              >
                {selectedMentionMembers.length}{' '}
                {selectedMentionMembers.length === 1
                  ? 'member'
                  : 'members'}{' '}
                selected
              </Text>
            </View>

            {membersLoading ? (
              <View
                style={styles.emptyContainer}
              >
                <ActivityIndicator
                  size="small"
                  color={primaryColor}
                />

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: subTextColor,
                    },
                  ]}
                >
                  Loading group members...
                </Text>
              </View>
            ) : groupMembers.length === 0 ? (
              <View
                style={styles.emptyContainer}
              >
                <Icon
                  name="people-outline"
                  size={40}
                  color={subTextColor}
                />

                <Text
                  style={[
                    styles.emptyTitle,
                    {
                      color: textColor,
                    },
                  ]}
                >
                  No registered members
                </Text>

                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: subTextColor,
                    },
                  ]}
                >
                  There are no registered group
                  members available to mention.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.memberList}
                showsVerticalScrollIndicator={
                  false
                }
              >
                {groupMembers.map(
                  (member, index) => {
                    const isSelected =
                      isMemberSelected(
                        member
                      );

                    return (
                      <TouchableOpacity
                        key={`${member.userId}-${index}`}
                        style={[
                          styles.memberItem,
                          {
                            backgroundColor:
                              isSelected
                                ? `${primaryColor}15`
                                : inputBg,

                            borderColor:
                              isSelected
                                ? primaryColor
                                : borderClr,
                          },
                        ]}
                        onPress={() =>
                          toggleMentionMember(
                            member
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.memberAvatar,
                            {
                              backgroundColor:
                                isSelected
                                  ? primaryColor
                                  : `${primaryColor}20`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.memberAvatarText,
                              {
                                color:
                                  isSelected
                                    ? '#FFFFFF'
                                    : primaryColor,
                              },
                            ]}
                          >
                            {(
                              member.displayName?.charAt(
                                0
                              ) || 'M'
                            ).toUpperCase()}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.memberInfo
                          }
                        >
                          <Text
                            style={[
                              styles.memberName,
                              {
                                color: textColor,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {
                              member.displayName
                            }
                          </Text>

                          {!!member.phone && (
                            <Text
                              style={[
                                styles.memberPhone,
                                {
                                  color:
                                    subTextColor,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {member.phone}
                            </Text>
                          )}
                        </View>

                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor:
                                isSelected
                                  ? primaryColor
                                  : subTextColor,

                              backgroundColor:
                                isSelected
                                  ? primaryColor
                                  : 'transparent',
                            },
                          ]}
                        >
                          {isSelected && (
                            <Icon
                              name="checkmark"
                              size={17}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.modalDoneButton,
                {
                  backgroundColor:
                    primaryColor,
                },
              ]}
              onPress={() =>
                setShowMentionModal(false)
              }
              activeOpacity={0.8}
            >
              <Text
                style={
                  styles.modalDoneText
                }
              >
                DONE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalCancelButton,
                {
                  borderColor: borderClr,
                },
              ]}
              onPress={() =>
                setShowMentionModal(false)
              }
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalCancelText,
                  {
                    color: textColor,
                  },
                ]}
              >
                CANCEL
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.bg || '#F8FAFC',
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? 'light-content'
            : 'dark-content'
        }
        backgroundColor={
          theme.bg || '#F8FAFC'
        }
        translucent={
          Platform.OS === 'android'
        }
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor:
              theme.bg || '#F8FAFC',
            borderBottomColor: borderClr,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            navigation.goBack()
          }
          style={[
            styles.backBtn,
            {
              backgroundColor: inputBg,
            },
          ]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon
            name="arrow-back"
            size={20}
            color={textColor}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.headerBox,
            {
              backgroundColor:
                theme.headerBox ||
                inputBg,
            },
          ]}
        >
          <Text
            style={[
              styles.headerText,
              {
                color: textColor,
              },
            ]}
          >
            New Task
          </Text>
        </View>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={
            styles.responsiveWrapper
          }
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: borderClr,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: primaryColor,
                },
              ]}
            >
              Task Title
            </Text>

            <TextInput
              placeholder="e.g. System Architecture Design"
              placeholderTextColor={
                subTextColor
              }
              style={[
                styles.input,
                {
                  color: textColor,
                  backgroundColor:
                    inputBg,
                  borderColor:
                    borderClr,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: borderClr,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: primaryColor,
                },
              ]}
            >
              Description
            </Text>

            <TextInput
              placeholder="Provide detailed instructions or goals..."
              placeholderTextColor={
                subTextColor
              }
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[
                styles.input,
                styles.descriptionInput,
                {
                  color: textColor,
                  backgroundColor:
                    inputBg,
                  borderColor:
                    borderClr,
                },
              ]}
              value={description}
              onChangeText={
                setDescription
              }
            />
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: borderClr,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: primaryColor,
                },
              ]}
            >
              Task Mode
            </Text>

            <View
              style={styles.radioRow}
            >
              <TouchableOpacity
                onPress={() =>
                  setTaskType('time')
                }
                style={[
                  styles.radioItem,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      taskType === 'time'
                        ? primaryColor
                        : borderClr,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor:
                        taskType === 'time'
                          ? primaryColor
                          : subTextColor,
                    },
                  ]}
                >
                  {taskType ===
                    'time' && (
                    <View
                      style={[
                        styles.radioInner,
                        {
                          backgroundColor:
                            primaryColor,
                        },
                      ]}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.radioText,
                    {
                      color:
                        textColor,
                      fontWeight:
                        taskType === 'time'
                          ? '700'
                          : '500',
                    },
                  ]}
                >
                  Time Based
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={
                  handleNonTimeBased
                }
                style={[
                  styles.radioItem,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      taskType === 'non'
                        ? primaryColor
                        : borderClr,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor:
                        taskType === 'non'
                          ? primaryColor
                          : subTextColor,
                    },
                  ]}
                >
                  {taskType ===
                    'non' && (
                    <View
                      style={[
                        styles.radioInner,
                        {
                          backgroundColor:
                            primaryColor,
                        },
                      ]}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.radioText,
                    {
                      color:
                        textColor,
                      fontWeight:
                        taskType === 'non'
                          ? '700'
                          : '500',
                    },
                  ]}
                >
                  Non-Time Based
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLocationBased}
                style={[
                  styles.radioItem,
                  {
                    backgroundColor: inputBg,
                    borderColor: borderClr,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor: subTextColor,
                    },
                  ]}
                />

                <View style={styles.radioTextWrapper}>
                  <Text
                    style={[
                      styles.radioLabelText,
                      {
                        color: textColor,
                      },
                    ]}
                  >
                    Location Based
                  </Text>

                  <Text
                    style={[
                      styles.radioSubLabelText,
                      {
                        color: subTextColor,
                      },
                    ]}
                  >
                    Remind me when I arrive at a place
                  </Text>
                </View>

                <Icon
                  name="location-outline"
                  size={18}
                  color={subTextColor}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: borderClr,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: primaryColor,
                },
              ]}
            >
              Date & Time Settings
            </Text>

            <View
              style={styles.calendarBox}
            >
              <TouchableOpacity
                onPress={() =>
                  setShowDate(true)
                }
                style={[
                  styles.dateRow,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      borderClr,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={
                    styles.dateTimeInfo
                  }
                >
                  <Icon
                    name="calendar-outline"
                    size={18}
                    color={primaryColor}
                  />

                  <Text
                    style={[
                      styles.dateText,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    {date.toLocaleDateString()}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.changeText,
                    {
                      color:
                        primaryColor,
                    },
                  ]}
                >
                  Change Date
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setShowTime(true)
                }
                style={[
                  styles.dateRow,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      borderClr,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={
                    styles.dateTimeInfo
                  }
                >
                  <Icon
                    name="time-outline"
                    size={18}
                    color={primaryColor}
                  />

                  <Text
                    style={[
                      styles.dateText,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    {date.toLocaleTimeString(
                      [],
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.changeText,
                    {
                      color:
                        primaryColor,
                    },
                  ]}
                >
                  Change Time
                </Text>
              </TouchableOpacity>

              {showDate && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={
                    Platform.OS === 'ios'
                      ? 'spinner'
                      : 'calendar'
                  }
                  onChange={
                    onChangeDate
                  }
                />
              )}

              {showTime && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  display={
                    Platform.OS === 'ios'
                      ? 'spinner'
                      : 'clock'
                  }
                  onChange={
                    onChangeTime
                  }
                />
              )}
            </View>
          </View>

          {groupIdParam && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    cardBg,
                  borderColor:
                    borderClr,
                },
              ]}
            >
              <View
                style={
                  styles.mentionHeader
                }
              >
                <View
                  style={
                    styles.mentionLabelContainer
                  }
                >
                  <Icon
                    name="at-outline"
                    size={18}
                    color={
                      primaryColor
                    }
                  />

                  <Text
                    style={[
                      styles.label,
                      styles.mentionLabel,
                      {
                        color:
                          primaryColor,
                      },
                    ]}
                  >
                    Mention Group Members
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.dropdown,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      selectedMentionMembers.length >
                      0
                        ? primaryColor
                        : borderClr,
                  },
                ]}
                onPress={() =>
                  setShowMentionModal(
                    true
                  )
                }
                activeOpacity={0.7}
              >
                <View
                  style={
                    styles.selectedMention
                  }
                >
                  <View
                    style={[
                      styles.smallAvatar,
                      {
                        backgroundColor:
                          selectedMentionMembers.length >
                          0
                            ? primaryColor
                            : `${primaryColor}20`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallAvatarText,
                        {
                          color:
                            selectedMentionMembers.length >
                            0
                              ? '#FFFFFF'
                              : primaryColor,
                        },
                      ]}
                    >
                      {selectedMentionMembers.length >
                      0
                        ? String(
                            selectedMentionMembers.length
                          )
                        : '@'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.selectedMentionInfo
                    }
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        {
                          color:
                            textColor,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {selectedMentionMembers.length ===
                      0
                        ? 'No members selected'
                        : selectedMentionMembers.length ===
                          1
                        ? selectedMentionMembers[0]
                            .displayName
                        : `${selectedMentionMembers.length} members selected`}
                    </Text>

                    {selectedMentionMembers.length >
                      0 && (
                      <Text
                        style={[
                          styles.mentionSubText,
                          {
                            color:
                              subTextColor,
                          },
                        ]}
                      >
                        Tap to change selection
                      </Text>
                    )}
                  </View>
                </View>

                <Icon
                  name="chevron-down"
                  size={18}
                  color={
                    subTextColor
                  }
                />
              </TouchableOpacity>

              {selectedMentionMembers.length >
                0 && (
                <View
                  style={
                    styles.selectedMembersPreview
                  }
                >
                  {selectedMentionMembers.map(
                    (member) => (
                      <View
                        key={String(
                          member.userId
                        )}
                        style={[
                          styles.selectedMemberChip,
                          {
                            backgroundColor:
                              `${primaryColor}15`,
                            borderColor:
                              `${primaryColor}35`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectedMemberChipText,
                            {
                              color:
                                primaryColor,
                            },
                          ]}
                          numberOfLines={
                            1
                          }
                        >
                          {member.displayName}
                        </Text>

                        <TouchableOpacity
                          onPress={() =>
                            toggleMentionMember(
                              member
                            )
                          }
                          activeOpacity={
                            0.7
                          }
                        >
                          <Icon
                            name="close-circle"
                            size={17}
                            color={
                              primaryColor
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </View>
              )}

              <Text
                style={[
                  styles.helperText,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                You can select no member, one
                member, or multiple members.
                Selected members will receive a
                notification when the task is
                created.
              </Text>
            </View>
          )}

          <View
            style={styles.btnRow}
          >
            <TouchableOpacity
              style={[
                styles.btn,
                styles.cancelBtn,
                {
                  borderColor:
                    borderClr,
                },
              ]}
              onPress={() =>
                navigation.goBack()
              }
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.btnText,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                CANCEL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btn,
                styles.submitBtn,
                {
                  backgroundColor:
                    primaryColor,
                },
                loading &&
                  styles.btnDisabled,
              ]}
              onPress={AddTask}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              ) : (
                <Text
                  style={
                    styles.submitBtnText
                  }
                >
                  ADD TASK
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottom,
          {
            backgroundColor:
              theme.bottomNav ||
              (isDark
                ? '#1E293B'
                : '#0F172A'),

            borderTopColor:
              borderClr,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              'HomeDashboard'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="home-outline"
            size={22}
            color="#94A3B8"
          />

          <Text
            style={
              styles.bottomNavText
            }
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              'AddMember'
            )
          }
          activeOpacity={0.7}
        >
          <Icon
            name="person-add-outline"
            size={22}
            color="#94A3B8"
          />

          <Text
            style={
              styles.bottomNavText
            }
          >
            Members
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
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

          <Text
            style={
              styles.bottomNavText
            }
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
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

          <Text
            style={
              styles.bottomNavText
            }
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {renderMentionModal()}
    </SafeAreaView>
  );
};

export default AddTaskTimeBased;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight || 24) + 8
        : 12,
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

  headerSpacer: {
    width: 40,
  },

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
    shadowOffset: {
      width: 0,
      height: 1,
    },
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

  descriptionInput: {
    minHeight: 110,
  },

  radioRow: {
    flexDirection:
      width < 360
        ? 'column'
        : 'row',
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

  radioText: {
    fontSize: 14,
  },

  calendarBox: {
    gap: 10,
  },

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

  mentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  mentionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  mentionLabel: {
    marginBottom: 10,
    marginLeft: 7,
  },

  selectedMention: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  smallAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  smallAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },

  selectedMentionInfo: {
    flex: 1,
    minWidth: 0,
  },

  mentionSubText: {
    fontSize: 11,
    marginTop: 2,
  },

  selectedMembersPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },

  selectedMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
  },

  selectedMemberChipText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 5,
    maxWidth: 180,
  },

  helperText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  btnDisabled: {
    opacity: 0.6,
  },

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
    shadowOffset: {
      width: 0,
      height: -3,
    },
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },

  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  modalSubtitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },

  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    paddingTop: 2,
  },

  selectedCountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    gap: 7,
  },

  selectedCountText: {
    fontSize: 13,
    fontWeight: '700',
  },

  memberList: {
    maxHeight: 390,
  },

  memberItem: {
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  memberAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },

  memberInfo: {
    flex: 1,
    minWidth: 0,
  },

  memberName: {
    fontSize: 15,
    fontWeight: '700',
  },

  memberPhone: {
    fontSize: 12,
    marginTop: 3,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },

  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  modalDoneButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  modalCancelButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

















































// import React, { useEffect, useState } from 'react';
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
//   StatusBar,
//   Dimensions,
//   Modal,
// } from 'react-native';

// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Icon from '@react-native-vector-icons/ionicons';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import { useTheme } from '../../context/ThemeContext';
// import { BASE_URL } from '../../config/api';

// const { width } = Dimensions.get('window');

// const AddTaskTimeBased = ({ navigation, route }) => {
//   const { isDark, theme } = useTheme();

//   const [taskType, setTaskType] = useState('time');

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');

//   const [date, setDate] = useState(new Date());
//   const [showDate, setShowDate] = useState(false);
//   const [showTime, setShowTime] = useState(false);

//   const [loading, setLoading] = useState(false);

//   const [groupMembers, setGroupMembers] = useState([]);
//   const [selectedMentionMember, setSelectedMentionMember] = useState(null);
//   const [showMentionModal, setShowMentionModal] = useState(false);
//   const [membersLoading, setMembersLoading] = useState(false);

//   const groupIdParam = route?.params?.groupId || null;

//   const primaryColor = theme.primary || '#2563EB';
//   const cardBg = theme.card || '#FFFFFF';
//   const textColor = theme.text || '#0F172A';
//   const subTextColor = theme.subText || '#64748B';
//   const borderClr = theme.border || '#E2E8F0';
//   const inputBg =
//     theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

//   const goToLogin = async () => {
//     await AsyncStorage.removeItem('token');

//     navigation.reset({
//       index: 0,
//       routes: [
//         {
//           name: 'AuthStack',
//           state: {
//             routes: [{ name: 'Login' }],
//           },
//         },
//       ],
//     });
//   };

//   const parseResponse = async (response) => {
//     const text = await response.text();

//     if (!text) {
//       return {};
//     }

//     try {
//       return JSON.parse(text);
//     } catch (error) {
//       return {
//         message: text,
//       };
//     }
//   };

//   const getTaskIdFromResponse = (data) => {
//     return (
//       data?.data?.id ??
//       data?.data?.taskId ??
//       data?.taskId ??
//       data?.id ??
//       null
//     );
//   };

//   useEffect(() => {
//     const fetchGroupMembers = async () => {
//       if (!groupIdParam) {
//         setGroupMembers([]);
//         return;
//       }

//       try {
//         setMembersLoading(true);

//         const token = await AsyncStorage.getItem('token');

//         if (!token) {
//           return;
//         }

//         const response = await fetch(`${BASE_URL}/Task/groups`, {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         });

//         if (response.status === 401) {
//           await goToLogin();
//           return;
//         }

//         const data = await parseResponse(response);

//         if (!response.ok) {
//           console.log(
//             'Failed to fetch group members:',
//             data?.message
//           );
//           return;
//         }

//         const groupsData = Array.isArray(data?.data)
//           ? data.data
//           : [];

//         const currentGroup = groupsData.find(
//           (group) =>
//             String(group?.id ?? group?.groupId) ===
//             String(groupIdParam)
//         );

//         const members = Array.isArray(currentGroup?.members)
//           ? currentGroup.members
//           : [];

//         const normalizedMembers = members
//           .map((member) => {
//             const userId =
//               member?.userId ??
//               member?.id ??
//               member?.UserId ??
//               null;

//             const firstName =
//               member?.firstName ??
//               member?.FirstName ??
//               '';

//             const lastName =
//               member?.lastName ??
//               member?.LastName ??
//               '';

//             const displayName =
//               member?.displayName ??
//               member?.name ??
//               member?.fullName ??
//               `${firstName} ${lastName}`.trim();

//             return {
//               ...member,
//               userId:
//                 userId !== null
//                   ? Number(userId)
//                   : null,
//               displayName:
//                 displayName ||
//                 member?.phone ||
//                 member?.PhoneNumber ||
//                 'Group Member',
//               phone:
//                 member?.phone ??
//                 member?.PhoneNumber ??
//                 '',
//               isRegistered:
//                 member?.isRegistered !== false &&
//                 userId !== null &&
//                 Number(userId) > 0,
//             };
//           })
//           .filter(
//             (member) =>
//               member.isRegistered &&
//               Number(member.userId) > 0
//           );

//         setGroupMembers(normalizedMembers);
//       } catch (error) {
//         console.log('Error fetching group members:', error);
//       } finally {
//         setMembersLoading(false);
//       }
//     };

//     fetchGroupMembers();
//   }, [groupIdParam]);

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

//   const formatDueDate = (d) => {
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');

//     return `${year}-${month}-${day}`;
//   };

//   const formatDueTime = (d) => {
//     const hours = String(d.getHours()).padStart(2, '0');
//     const minutes = String(d.getMinutes()).padStart(2, '0');
//     const seconds = String(d.getSeconds()).padStart(2, '0');

//     return `${hours}:${minutes}:${seconds}`;
//   };

//   const mentionUser = async (taskId, member, token) => {
//     if (!taskId || !member?.userId) {
//       return {
//         success: false,
//         message: 'No member selected for mention.',
//       };
//     }

//     try {
//       const response = await fetch(
//         `${BASE_URL}/Task/${taskId}/mention`,
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             mentionedUserId: Number(member.userId),
//           }),
//         }
//       );

//       if (response.status === 401) {
//         await goToLogin();

//         return {
//           success: false,
//           message: 'Session expired.',
//         };
//       }

//       const data = await parseResponse(response);

//       console.log('Mention API Status:', response.status);
//       console.log('Mention API Response:', data);

//       if (!response.ok || !data?.success) {
//         return {
//           success: false,
//           message:
//             data?.message ||
//             `Failed to mention member. HTTP ${response.status}`,
//         };
//       }

//       return {
//         success: true,
//         data: data?.data,
//         message:
//           data?.message ||
//           'Member mentioned successfully.',
//       };
//     } catch (error) {
//       console.log('Mention User Error:', error);

//       return {
//         success: false,
//         message:
//           error?.message ||
//           'Unable to mention the selected member.',
//       };
//     }
//   };

//   const getTaskMentions = async (taskId, token) => {
//     if (!taskId) {
//       return [];
//     }

//     try {
//       const response = await fetch(
//         `${BASE_URL}/Task/${taskId}/mentions`,
//         {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (response.status === 401) {
//         await goToLogin();
//         return [];
//       }

//       const data = await parseResponse(response);

//       console.log('Get Mentions Status:', response.status);
//       console.log('Get Mentions Response:', data);

//       if (response.ok && data?.success) {
//         return Array.isArray(data?.data)
//           ? data.data
//           : [];
//       }

//       return [];
//     } catch (error) {
//       console.log('Get Task Mentions Error:', error);
//       return [];
//     }
//   };

//   const AddTask = async () => {
//     if (!title.trim()) {
//       Alert.alert('Error', 'Please enter task title.');
//       return;
//     }

//     if (!description.trim()) {
//       Alert.alert('Error', 'Please enter task description.');
//       return;
//     }

//     const token = await AsyncStorage.getItem('token');

//     if (!token) {
//       Alert.alert(
//         'Session Expired',
//         'Please login again.',
//         [
//           {
//             text: 'OK',
//             onPress: goToLogin,
//           },
//         ]
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const formattedDate = formatDueDate(date);
//       const formattedTime = formatDueTime(date);

//       const response = await fetch(
//         `${BASE_URL}/Managment/task`,
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: title.trim(),
//             description: description.trim(),
//             dueDate: formattedDate,
//             dueTime: formattedTime,
//             isTimeBased: true,
//             groupId: groupIdParam
//               ? parseInt(groupIdParam, 10)
//               : null,
//           }),
//         }
//       );

//       if (response.status === 401) {
//         await goToLogin();
//         return;
//       }

//       const responseData = await parseResponse(response);

//       console.log(
//         'Create Task Response Status:',
//         response.status
//       );

//       console.log(
//         'Create Task Response Body:',
//         responseData
//       );

//       if (
//         !response.ok ||
//         !(
//           responseData?.success ||
//           response.status === 200 ||
//           response.status === 201
//         )
//       ) {
//         Alert.alert(
//           'Error',
//           responseData?.message ||
//             `Failed to create task (HTTP ${response.status}).`
//         );
//         return;
//       }

//       const createdTaskId =
//         getTaskIdFromResponse(responseData);

//       let mentionResult = null;

//       if (
//         groupIdParam &&
//         selectedMentionMember?.userId &&
//         createdTaskId
//       ) {
//         mentionResult = await mentionUser(
//           createdTaskId,
//           selectedMentionMember,
//           token
//         );

//         if (mentionResult.success) {
//           const verifiedMentions =
//             await getTaskMentions(
//               createdTaskId,
//               token
//             );

//           console.log(
//             'Verified task mentions:',
//             verifiedMentions
//           );
//         }
//       }

//       if (
//         selectedMentionMember &&
//         !createdTaskId
//       ) {
//         Alert.alert(
//           'Task Created',
//           'The task was created, but the task ID was not returned by the server, so the member could not be mentioned.'
//         );

//         navigation.goBack();
//         return;
//       }

//       if (
//         selectedMentionMember &&
//         createdTaskId &&
//         mentionResult &&
//         !mentionResult.success
//       ) {
//         Alert.alert(
//           'Task Created',
//           `Task was created successfully, but ${selectedMentionMember.displayName} could not be mentioned.\n\n${mentionResult.message}`,
//           [
//             {
//               text: 'OK',
//               onPress: () => navigation.goBack(),
//             },
//           ]
//         );

//         return;
//       }

//       let successMessage =
//         responseData?.message ||
//         'Task created successfully.';

//       if (
//         mentionResult?.success &&
//         selectedMentionMember
//       ) {
//         successMessage += `\n\n${selectedMentionMember.displayName} was mentioned successfully.`;
//       }

//       Alert.alert(
//         'Success',
//         successMessage,
//         [
//           {
//             text: 'OK',
//             onPress: () => navigation.goBack(),
//           },
//         ]
//       );

//       setTitle('');
//       setDescription('');
//       setDate(new Date());
//       setSelectedMentionMember(null);
//     } catch (error) {
//       console.log('Add Task Error:', error);

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Server not reachable.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleNonTimeBased = () => {
//     setTaskType('non');

//     navigation.navigate(
//       'AddTaskNonTimeBased',
//       {
//         groupId: groupIdParam,
//       }
//     );
//   };

//   const renderMentionModal = () => {
//     return (
//       <Modal
//         visible={showMentionModal}
//         transparent
//         animationType="slide"
//         onRequestClose={() =>
//           setShowMentionModal(false)
//         }
//       >
//         <View style={styles.modalOverlay}>
//           <View
//             style={[
//               styles.modalContainer,
//               {
//                 backgroundColor: cardBg,
//               },
//             ]}
//           >
//             <View style={styles.modalHeader}>
//               <View style={styles.modalTitleContainer}>
//                 <Icon
//                   name="at-outline"
//                   size={22}
//                   color={primaryColor}
//                 />

//                 <Text
//                   style={[
//                     styles.modalTitle,
//                     { color: textColor },
//                   ]}
//                 >
//                   Mention Group Member
//                 </Text>
//               </View>

//               <TouchableOpacity
//                 onPress={() =>
//                   setShowMentionModal(false)
//                 }
//                 style={[
//                   styles.modalCloseButton,
//                   { backgroundColor: inputBg },
//                 ]}
//               >
//                 <Icon
//                   name="close"
//                   size={20}
//                   color={textColor}
//                 />
//               </TouchableOpacity>
//             </View>

//             <Text
//               style={[
//                 styles.modalSubtitle,
//                 { color: subTextColor },
//               ]}
//             >
//               Select a registered group member to
//               mention in this task.
//             </Text>

//             {membersLoading ? (
//               <View style={styles.emptyContainer}>
//                 <ActivityIndicator
//                   size="small"
//                   color={primaryColor}
//                 />

//                 <Text
//                   style={[
//                     styles.emptyText,
//                     { color: subTextColor },
//                   ]}
//                 >
//                   Loading group members...
//                 </Text>
//               </View>
//             ) : groupMembers.length === 0 ? (
//               <View style={styles.emptyContainer}>
//                 <Icon
//                   name="people-outline"
//                   size={40}
//                   color={subTextColor}
//                 />

//                 <Text
//                   style={[
//                     styles.emptyTitle,
//                     { color: textColor },
//                   ]}
//                 >
//                   No registered members
//                 </Text>

//                 <Text
//                   style={[
//                     styles.emptyText,
//                     { color: subTextColor },
//                   ]}
//                 >
//                   There are no registered group members
//                   available to mention.
//                 </Text>
//               </View>
//             ) : (
//               <ScrollView
//                 style={styles.memberList}
//                 showsVerticalScrollIndicator={false}
//               >
//                 {groupMembers.map((member, index) => {
//                   const isSelected =
//                     selectedMentionMember?.userId ===
//                     member.userId;

//                   return (
//                     <TouchableOpacity
//                       key={`${member.userId}-${index}`}
//                       style={[
//                         styles.memberItem,
//                         {
//                           backgroundColor: isSelected
//                             ? `${primaryColor}15`
//                             : inputBg,
//                           borderColor: isSelected
//                             ? primaryColor
//                             : borderClr,
//                         },
//                       ]}
//                       onPress={() => {
//                         setSelectedMentionMember(member);
//                         setShowMentionModal(false);
//                       }}
//                       activeOpacity={0.7}
//                     >
//                       <View
//                         style={[
//                           styles.memberAvatar,
//                           {
//                             backgroundColor:
//                               isSelected
//                                 ? primaryColor
//                                 : `${primaryColor}20`,
//                           },
//                         ]}
//                       >
//                         <Text
//                           style={[
//                             styles.memberAvatarText,
//                             {
//                               color: isSelected
//                                 ? '#FFFFFF'
//                                 : primaryColor,
//                             },
//                           ]}
//                         >
//                           {(
//                             member.displayName?.charAt(
//                               0
//                             ) || 'M'
//                           ).toUpperCase()}
//                         </Text>
//                       </View>

//                       <View
//                         style={styles.memberInfo}
//                       >
//                         <Text
//                           style={[
//                             styles.memberName,
//                             { color: textColor },
//                           ]}
//                           numberOfLines={1}
//                         >
//                           {member.displayName}
//                         </Text>

//                         {!!member.phone && (
//                           <Text
//                             style={[
//                               styles.memberPhone,
//                               {
//                                 color: subTextColor,
//                               },
//                             ]}
//                             numberOfLines={1}
//                           >
//                             {member.phone}
//                           </Text>
//                         )}
//                       </View>

//                       {isSelected && (
//                         <Icon
//                           name="checkmark-circle"
//                           size={24}
//                           color={primaryColor}
//                         />
//                       )}
//                     </TouchableOpacity>
//                   );
//                 })}
//               </ScrollView>
//             )}

//             <TouchableOpacity
//               style={[
//                 styles.modalCancelButton,
//                 {
//                   borderColor: borderClr,
//                 },
//               ]}
//               onPress={() =>
//                 setShowMentionModal(false)
//               }
//               activeOpacity={0.7}
//             >
//               <Text
//                 style={[
//                   styles.modalCancelText,
//                   { color: textColor },
//                 ]}
//               >
//                 CANCEL
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     );
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         {
//           backgroundColor:
//             theme.bg || '#F8FAFC',
//         },
//       ]}
//     >
//       <StatusBar
//         barStyle={
//           isDark
//             ? 'light-content'
//             : 'dark-content'
//         }
//         backgroundColor={
//           theme.bg || '#F8FAFC'
//         }
//         translucent={
//           Platform.OS === 'android'
//         }
//       />

//       <View
//         style={[
//           styles.header,
//           {
//             backgroundColor:
//               theme.bg || '#F8FAFC',
//             borderBottomColor: borderClr,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={[
//             styles.backBtn,
//             { backgroundColor: inputBg },
//           ]}
//           activeOpacity={0.7}
//           accessibilityRole="button"
//           accessibilityLabel="Go back"
//         >
//           <Icon
//             name="arrow-back"
//             size={20}
//             color={textColor}
//           />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             {
//               backgroundColor:
//                 theme.headerBox ||
//                 inputBg,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.headerText,
//               { color: textColor },
//             ]}
//           >
//             New Task
//           </Text>
//         </View>

//         <View style={styles.headerSpacer} />
//       </View>

//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
//       >
//         <View style={styles.responsiveWrapper}>
//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Task Title
//             </Text>

//             <TextInput
//               placeholder="e.g. System Architecture Design"
//               placeholderTextColor={subTextColor}
//               style={[
//                 styles.input,
//                 {
//                   color: textColor,
//                   backgroundColor: inputBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//               value={title}
//               onChangeText={setTitle}
//               maxLength={200}
//             />
//           </View>

//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Description
//             </Text>

//             <TextInput
//               placeholder="Provide detailed instructions or goals..."
//               placeholderTextColor={subTextColor}
//               multiline
//               numberOfLines={4}
//               textAlignVertical="top"
//               style={[
//                 styles.input,
//                 styles.descriptionInput,
//                 {
//                   color: textColor,
//                   backgroundColor: inputBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//               value={description}
//               onChangeText={setDescription}
//             />
//           </View>

//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Task Mode
//             </Text>

//             <View style={styles.radioRow}>
//               <TouchableOpacity
//                 onPress={() => setTaskType('time')}
//                 style={[
//                   styles.radioItem,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       taskType === 'time'
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View
//                   style={[
//                     styles.radioOuter,
//                     {
//                       borderColor:
//                         taskType === 'time'
//                           ? primaryColor
//                           : subTextColor,
//                     },
//                   ]}
//                 >
//                   {taskType === 'time' && (
//                     <View
//                       style={[
//                         styles.radioInner,
//                         {
//                           backgroundColor:
//                             primaryColor,
//                         },
//                       ]}
//                     />
//                   )}
//                 </View>

//                 <Text
//                   style={[
//                     styles.radioText,
//                     {
//                       color: textColor,
//                       fontWeight:
//                         taskType === 'time'
//                           ? '700'
//                           : '500',
//                     },
//                   ]}
//                 >
//                   Time Based
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 onPress={handleNonTimeBased}
//                 style={[
//                   styles.radioItem,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       taskType === 'non'
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View
//                   style={[
//                     styles.radioOuter,
//                     {
//                       borderColor:
//                         taskType === 'non'
//                           ? primaryColor
//                           : subTextColor,
//                     },
//                   ]}
//                 >
//                   {taskType === 'non' && (
//                     <View
//                       style={[
//                         styles.radioInner,
//                         {
//                           backgroundColor:
//                             primaryColor,
//                         },
//                       ]}
//                     />
//                   )}
//                 </View>

//                 <Text
//                   style={[
//                     styles.radioText,
//                     {
//                       color: textColor,
//                       fontWeight:
//                         taskType === 'non'
//                           ? '700'
//                           : '500',
//                     },
//                   ]}
//                 >
//                   Non-Time Based
//                 </Text>
//               </TouchableOpacity>
//             </View>
//           </View>

//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Date & Time Settings
//             </Text>

//             <View style={styles.calendarBox}>
//               <TouchableOpacity
//                 onPress={() => setShowDate(true)}
//                 style={[
//                   styles.dateRow,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor: borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View style={styles.dateTimeInfo}>
//                   <Icon
//                     name="calendar-outline"
//                     size={18}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.dateText,
//                       {
//                         color: textColor,
//                       },
//                     ]}
//                   >
//                     {date.toLocaleDateString()}
//                   </Text>
//                 </View>

//                 <Text
//                   style={[
//                     styles.changeText,
//                     {
//                       color: primaryColor,
//                     },
//                   ]}
//                 >
//                   Change Date
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 onPress={() => setShowTime(true)}
//                 style={[
//                   styles.dateRow,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor: borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View style={styles.dateTimeInfo}>
//                   <Icon
//                     name="time-outline"
//                     size={18}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.dateText,
//                       {
//                         color: textColor,
//                       },
//                     ]}
//                   >
//                     {date.toLocaleTimeString([], {
//                       hour: '2-digit',
//                       minute: '2-digit',
//                     })}
//                   </Text>
//                 </View>

//                 <Text
//                   style={[
//                     styles.changeText,
//                     {
//                       color: primaryColor,
//                     },
//                   ]}
//                 >
//                   Change Time
//                 </Text>
//               </TouchableOpacity>

//               {showDate && (
//                 <DateTimePicker
//                   value={date}
//                   mode="date"
//                   display={
//                     Platform.OS === 'ios'
//                       ? 'spinner'
//                       : 'calendar'
//                   }
//                   onChange={onChangeDate}
//                 />
//               )}

//               {showTime && (
//                 <DateTimePicker
//                   value={date}
//                   mode="time"
//                   display={
//                     Platform.OS === 'ios'
//                       ? 'spinner'
//                       : 'clock'
//                   }
//                   onChange={onChangeTime}
//                 />
//               )}
//             </View>
//           </View>

//           {groupIdParam && (
//             <View
//               style={[
//                 styles.card,
//                 {
//                   backgroundColor: cardBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//             >
//               <View style={styles.mentionHeader}>
//                 <View style={styles.mentionLabelContainer}>
//                   <Icon
//                     name="at-outline"
//                     size={18}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.label,
//                       styles.mentionLabel,
//                       {
//                         color: primaryColor,
//                       },
//                     ]}
//                   >
//                     Mention Group Member
//                   </Text>
//                 </View>
//               </View>

//               <TouchableOpacity
//                 style={[
//                   styles.dropdown,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       selectedMentionMember
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 onPress={() =>
//                   setShowMentionModal(true)
//                 }
//                 activeOpacity={0.7}
//               >
//                 <View style={styles.selectedMention}>
//                   <View
//                     style={[
//                       styles.smallAvatar,
//                       {
//                         backgroundColor:
//                           selectedMentionMember
//                             ? primaryColor
//                             : `${primaryColor}20`,
//                       },
//                     ]}
//                   >
//                     <Text
//                       style={[
//                         styles.smallAvatarText,
//                         {
//                           color:
//                             selectedMentionMember
//                               ? '#FFFFFF'
//                               : primaryColor,
//                         },
//                       ]}
//                     >
//                       {selectedMentionMember
//                         ? (
//                             selectedMentionMember.displayName?.charAt(
//                               0
//                             ) || 'M'
//                           ).toUpperCase()
//                         : '@'}
//                     </Text>
//                   </View>

//                   <View
//                     style={styles.selectedMentionInfo}
//                   >
//                     <Text
//                       style={[
//                         styles.dropdownText,
//                         {
//                           color: textColor,
//                         },
//                       ]}
//                       numberOfLines={1}
//                     >
//                       {selectedMentionMember
//                         ? selectedMentionMember.displayName
//                         : 'Select a group member'}
//                     </Text>

//                     {selectedMentionMember && (
//                       <Text
//                         style={[
//                           styles.mentionSubText,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         Will be mentioned after task creation
//                       </Text>
//                     )}
//                   </View>
//                 </View>

//                 <Icon
//                   name="chevron-down"
//                   size={18}
//                   color={subTextColor}
//                 />
//               </TouchableOpacity>

//               {selectedMentionMember && (
//                 <TouchableOpacity
//                   style={styles.removeMentionButton}
//                   onPress={() =>
//                     setSelectedMentionMember(null)
//                   }
//                   activeOpacity={0.7}
//                 >
//                   <Icon
//                     name="close-circle-outline"
//                     size={16}
//                     color="#EF4444"
//                   />

//                   <Text
//                     style={styles.removeMentionText}
//                   >
//                     Remove mention
//                   </Text>
//                 </TouchableOpacity>
//               )}

//               <Text
//                 style={[
//                   styles.helperText,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 The selected member will receive a
//                 notification when the task is created.
//               </Text>
//             </View>
//           )}

//           <View style={styles.btnRow}>
//             <TouchableOpacity
//               style={[
//                 styles.btn,
//                 styles.cancelBtn,
//                 {
//                   borderColor: borderClr,
//                 },
//               ]}
//               onPress={() => navigation.goBack()}
//               disabled={loading}
//               activeOpacity={0.7}
//             >
//               <Text
//                 style={[
//                   styles.btnText,
//                   { color: textColor },
//                 ]}
//               >
//                 CANCEL
//               </Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={[
//                 styles.btn,
//                 styles.submitBtn,
//                 {
//                   backgroundColor: primaryColor,
//                 },
//                 loading && styles.btnDisabled,
//               ]}
//               onPress={AddTask}
//               disabled={loading}
//               activeOpacity={0.8}
//             >
//               {loading ? (
//                 <ActivityIndicator
//                   color="#FFFFFF"
//                   size="small"
//                 />
//               ) : (
//                 <Text style={styles.submitBtnText}>
//                   ADD TASK
//                 </Text>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>
//       </ScrollView>

//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor:
//               theme.bottomNav ||
//               (isDark
//                 ? '#1E293B'
//                 : '#0F172A'),
//             borderTopColor: borderClr,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('HomeDashboard')
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="home-outline"
//             size={22}
//             color="#94A3B8"
//           />

//           <Text style={styles.bottomNavText}>
//             Home
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('AddMember')
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="person-add-outline"
//             size={22}
//             color="#94A3B8"
//           />

//           <Text style={styles.bottomNavText}>
//             Members
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
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

//           <Text style={styles.bottomNavText}>
//             History
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('SettingScreen')
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="settings-outline"
//             size={22}
//             color="#94A3B8"
//           />

//           <Text style={styles.bottomNavText}>
//             Settings
//           </Text>
//         </TouchableOpacity>
//       </View>

//       {renderMentionModal()}
//     </SafeAreaView>
//   );
// };

// export default AddTaskTimeBased;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingTop:
//       Platform.OS === 'android'
//         ? (StatusBar.currentHeight || 24) + 8
//         : 12,
//     paddingBottom: 12,
//     borderBottomWidth: 1,
//     zIndex: 10,
//   },

//   backBtn: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   headerBox: {
//     paddingHorizontal: 20,
//     paddingVertical: 6,
//     borderRadius: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   headerText: {
//     fontSize: 16,
//     fontWeight: '700',
//     letterSpacing: 0.3,
//   },

//   headerSpacer: {
//     width: 40,
//   },

//   content: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 110,
//   },

//   responsiveWrapper: {
//     width: '100%',
//     maxWidth: 600,
//     alignSelf: 'center',
//   },

//   card: {
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 16,
//     borderWidth: 1,
//     elevation: 1,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 1,
//     },
//     shadowOpacity: 0.04,
//     shadowRadius: 3,
//   },

//   label: {
//     fontSize: 12,
//     fontWeight: '700',
//     textTransform: 'uppercase',
//     letterSpacing: 0.8,
//     marginBottom: 10,
//   },

//   input: {
//     fontSize: 15,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//     minHeight: 50,
//   },

//   descriptionInput: {
//     minHeight: 110,
//   },

//   radioRow: {
//     flexDirection:
//       width < 360
//         ? 'column'
//         : 'row',
//     gap: 12,
//   },

//   radioItem: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: 12,
//     paddingHorizontal: 14,
//     borderRadius: 12,
//     borderWidth: 1.5,
//     minHeight: 50,
//   },

//   radioOuter: {
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     borderWidth: 2,
//     marginRight: 10,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   radioInner: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//   },

//   radioText: {
//     fontSize: 14,
//   },

//   calendarBox: {
//     gap: 10,
//   },

//   dateRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//     minHeight: 50,
//   },

//   dateTimeInfo: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },

//   dateText: {
//     fontSize: 14,
//     fontWeight: '600',
//   },

//   changeText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },

//   dropdown: {
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderWidth: 1,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     minHeight: 50,
//   },

//   dropdownText: {
//     fontSize: 14,
//     fontWeight: '500',
//   },

//   mentionHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   mentionLabelContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   mentionLabel: {
//     marginBottom: 10,
//     marginLeft: 7,
//   },

//   selectedMention: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     minWidth: 0,
//   },

//   smallAvatar: {
//     width: 34,
//     height: 34,
//     borderRadius: 17,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 10,
//   },

//   smallAvatarText: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   selectedMentionInfo: {
//     flex: 1,
//     minWidth: 0,
//   },

//   mentionSubText: {
//     fontSize: 11,
//     marginTop: 2,
//   },

//   removeMentionButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     alignSelf: 'flex-start',
//     marginTop: 10,
//     paddingVertical: 4,
//   },

//   removeMentionText: {
//     color: '#EF4444',
//     fontSize: 12,
//     fontWeight: '600',
//     marginLeft: 5,
//   },

//   helperText: {
//     fontSize: 11,
//     lineHeight: 16,
//     marginTop: 10,
//   },

//   btnRow: {
//     flexDirection: 'row',
//     gap: 12,
//     marginTop: 8,
//   },

//   btn: {
//     flex: 1,
//     paddingVertical: 14,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     minHeight: 52,
//   },

//   cancelBtn: {
//     backgroundColor: 'transparent',
//     borderWidth: 1,
//   },

//   submitBtn: {
//     elevation: 3,
//     shadowColor: '#2563EB',
//     shadowOffset: {
//       width: 0,
//       height: 3,
//     },
//     shadowOpacity: 0.3,
//     shadowRadius: 5,
//   },

//   btnDisabled: {
//     opacity: 0.6,
//   },

//   btnText: {
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },

//   submitBtnText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 65,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     borderTopWidth: 1,
//     elevation: 10,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: -3,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 6,
//     minHeight: 48,
//   },

//   bottomNavText: {
//     color: '#94A3B8',
//     fontSize: 10,
//     fontWeight: '600',
//     marginTop: 3,
//   },

//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.55)',
//     justifyContent: 'flex-end',
//   },

//   modalContainer: {
//     width: '100%',
//     maxHeight: '80%',
//     borderTopLeftRadius: 24,
//     borderTopRightRadius: 24,
//     padding: 20,
//   },

//   modalHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 8,
//   },

//   modalTitleContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//   },

//   modalTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     marginLeft: 8,
//   },

//   modalCloseButton: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   modalSubtitle: {
//     fontSize: 13,
//     lineHeight: 19,
//     marginBottom: 16,
//   },

//   memberList: {
//     maxHeight: 420,
//   },

//   memberItem: {
//     minHeight: 68,
//     borderRadius: 14,
//     borderWidth: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 12,
//     marginBottom: 10,
//   },

//   memberAvatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 21,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 12,
//   },

//   memberAvatarText: {
//     fontSize: 16,
//     fontWeight: '700',
//   },

//   memberInfo: {
//     flex: 1,
//     minWidth: 0,
//   },

//   memberName: {
//     fontSize: 15,
//     fontWeight: '700',
//   },

//   memberPhone: {
//     fontSize: 12,
//     marginTop: 3,
//   },

//   emptyContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 40,
//   },

//   emptyTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//     marginTop: 10,
//   },

//   emptyText: {
//     fontSize: 13,
//     textAlign: 'center',
//     marginTop: 6,
//     lineHeight: 19,
//   },

//   modalCancelButton: {
//     minHeight: 48,
//     borderRadius: 12,
//     borderWidth: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 14,
//   },

//   modalCancelText: {
//     fontSize: 13,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
// });



































// // import React, { useEffect, useState } from 'react';
// // import {
// //   SafeAreaView,
// //   View,
// //   Text,
// //   StyleSheet,
// //   TouchableOpacity,
// //   TextInput,
// //   ScrollView,
// //   Alert,
// //   Platform,
// //   ActivityIndicator,
// //   StatusBar,
// //   Dimensions,
// //   Modal,
// // } from 'react-native';

// // import AsyncStorage from '@react-native-async-storage/async-storage';
// // import Icon from '@react-native-vector-icons/ionicons';
// // import DateTimePicker from '@react-native-community/datetimepicker';
// // import { useTheme } from '../../context/ThemeContext';
// // import { BASE_URL } from '../../config/api';

// // const { width } = Dimensions.get('window');

// // const AddTaskTimeBased = ({ navigation, route }) => {
// //   const { isDark, theme } = useTheme();

// //   const [taskType, setTaskType] = useState('time');

// //   const [title, setTitle] = useState('');
// //   const [description, setDescription] = useState('');

// //   const [date, setDate] = useState(new Date());
// //   const [showDate, setShowDate] = useState(false);
// //   const [showTime, setShowTime] = useState(false);

// //   const [loading, setLoading] = useState(false);

// //   const [groups, setGroups] = useState([]);
// //   const [selectedGroup, setSelectedGroup] = useState(null);

// //   const [groupMembers, setGroupMembers] = useState([]);
// //   const [selectedMentionMember, setSelectedMentionMember] = useState(null);
// //   const [showMentionModal, setShowMentionModal] = useState(false);
// //   const [membersLoading, setMembersLoading] = useState(false);

// //   const groupIdParam = route?.params?.groupId || null;

// //   const primaryColor = theme.primary || '#2563EB';
// //   const cardBg = theme.card || '#FFFFFF';
// //   const textColor = theme.text || '#0F172A';
// //   const subTextColor = theme.subText || '#64748B';
// //   const borderClr = theme.border || '#E2E8F0';
// //   const inputBg =
// //     theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

// //   const goToLogin = async () => {
// //     await AsyncStorage.removeItem('token');

// //     navigation.reset({
// //       index: 0,
// //       routes: [
// //         {
// //           name: 'AuthStack',
// //           state: {
// //             routes: [{ name: 'Login' }],
// //           },
// //         },
// //       ],
// //     });
// //   };

// //   const parseResponse = async (response) => {
// //     const text = await response.text();

// //     if (!text) {
// //       return {};
// //     }

// //     try {
// //       return JSON.parse(text);
// //     } catch (error) {
// //       return {
// //         message: text,
// //       };
// //     }
// //   };

// //   const getTaskIdFromResponse = (data) => {
// //     return (
// //       data?.data?.id ??
// //       data?.data?.taskId ??
// //       data?.taskId ??
// //       data?.id ??
// //       null
// //     );
// //   };

// //   useEffect(() => {
// //     const fetchGroups = async () => {
// //       try {
// //         const token = await AsyncStorage.getItem('token');

// //         if (!token) {
// //           return;
// //         }

// //         const response = await fetch(`${BASE_URL}/Management/groups`, {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         });

// //         if (response.status === 401) {
// //           await goToLogin();
// //           return;
// //         }

// //         const data = await parseResponse(response);

// //         if (response.ok && data?.success) {
// //           const groupList = Array.isArray(data?.data)
// //             ? data.data
// //             : [];

// //           setGroups(groupList);

// //           if (groupIdParam) {
// //             const foundGroup = groupList.find(
// //               (group) =>
// //                 String(group?.id ?? group?.groupId) ===
// //                 String(groupIdParam)
// //             );

// //             if (foundGroup) {
// //               setSelectedGroup(foundGroup);
// //             }
// //           }
// //         }
// //       } catch (error) {
// //         console.log('Error fetching groups:', error);
// //       }
// //     };

// //     fetchGroups();
// //   }, [groupIdParam]);

// //   useEffect(() => {
// //     const fetchGroupMembers = async () => {
// //       if (!groupIdParam) {
// //         setGroupMembers([]);
// //         return;
// //       }

// //       try {
// //         setMembersLoading(true);

// //         const token = await AsyncStorage.getItem('token');

// //         if (!token) {
// //           return;
// //         }

// //         const response = await fetch(`${BASE_URL}/Task/groups`, {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         });

// //         if (response.status === 401) {
// //           await goToLogin();
// //           return;
// //         }

// //         const data = await parseResponse(response);

// //         if (!response.ok) {
// //           console.log(
// //             'Failed to fetch group members:',
// //             data?.message
// //           );
// //           return;
// //         }

// //         const groupsData = Array.isArray(data?.data)
// //           ? data.data
// //           : [];

// //         const currentGroup = groupsData.find(
// //           (group) =>
// //             String(group?.id ?? group?.groupId) ===
// //             String(groupIdParam)
// //         );

// //         const members = Array.isArray(currentGroup?.members)
// //           ? currentGroup.members
// //           : [];

// //         const normalizedMembers = members
// //           .map((member) => {
// //             const userId =
// //               member?.userId ??
// //               member?.id ??
// //               member?.UserId ??
// //               null;

// //             const firstName =
// //               member?.firstName ??
// //               member?.FirstName ??
// //               '';

// //             const lastName =
// //               member?.lastName ??
// //               member?.LastName ??
// //               '';

// //             const displayName =
// //               member?.displayName ??
// //               member?.name ??
// //               member?.fullName ??
// //               `${firstName} ${lastName}`.trim();

// //             return {
// //               ...member,
// //               userId:
// //                 userId !== null
// //                   ? Number(userId)
// //                   : null,
// //               displayName:
// //                 displayName ||
// //                 member?.phone ||
// //                 member?.PhoneNumber ||
// //                 'Group Member',
// //               phone:
// //                 member?.phone ??
// //                 member?.PhoneNumber ??
// //                 '',
// //               isRegistered:
// //                 member?.isRegistered !== false &&
// //                 userId !== null &&
// //                 Number(userId) > 0,
// //             };
// //           })
// //           .filter(
// //             (member) =>
// //               member.isRegistered &&
// //               Number(member.userId) > 0
// //           );

// //         setGroupMembers(normalizedMembers);
// //       } catch (error) {
// //         console.log('Error fetching group members:', error);
// //       } finally {
// //         setMembersLoading(false);
// //       }
// //     };

// //     fetchGroupMembers();
// //   }, [groupIdParam]);

// //   const onChangeDate = (event, selectedDate) => {
// //     if (Platform.OS === 'android') {
// //       setShowDate(false);
// //     }

// //     if (selectedDate) {
// //       const newDate = new Date(date);

// //       newDate.setFullYear(selectedDate.getFullYear());
// //       newDate.setMonth(selectedDate.getMonth());
// //       newDate.setDate(selectedDate.getDate());

// //       setDate(newDate);
// //     }
// //   };

// //   const onChangeTime = (event, selectedTime) => {
// //     if (Platform.OS === 'android') {
// //       setShowTime(false);
// //     }

// //     if (selectedTime) {
// //       const newDate = new Date(date);

// //       newDate.setHours(selectedTime.getHours());
// //       newDate.setMinutes(selectedTime.getMinutes());
// //       newDate.setSeconds(0);
// //       newDate.setMilliseconds(0);

// //       setDate(newDate);
// //     }
// //   };

// //   const formatDueDate = (d) => {
// //     const year = d.getFullYear();
// //     const month = String(d.getMonth() + 1).padStart(2, '0');
// //     const day = String(d.getDate()).padStart(2, '0');

// //     return `${year}-${month}-${day}`;
// //   };

// //   const formatDueTime = (d) => {
// //     const hours = String(d.getHours()).padStart(2, '0');
// //     const minutes = String(d.getMinutes()).padStart(2, '0');
// //     const seconds = String(d.getSeconds()).padStart(2, '0');

// //     return `${hours}:${minutes}:${seconds}`;
// //   };

// //   const mentionUser = async (taskId, member, token) => {
// //     if (!taskId || !member?.userId) {
// //       return {
// //         success: false,
// //         message: 'No member selected for mention.',
// //       };
// //     }

// //     try {
// //       const response = await fetch(
// //         `${BASE_URL}/Task/${taskId}/mention`,
// //         {
// //           method: 'POST',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //           body: JSON.stringify({
// //             mentionedUserId: Number(member.userId),
// //           }),
// //         }
// //       );

// //       if (response.status === 401) {
// //         await goToLogin();

// //         return {
// //           success: false,
// //           message: 'Session expired.',
// //         };
// //       }

// //       const data = await parseResponse(response);

// //       console.log('Mention API Status:', response.status);
// //       console.log('Mention API Response:', data);

// //       if (!response.ok || !data?.success) {
// //         return {
// //           success: false,
// //           message:
// //             data?.message ||
// //             `Failed to mention member. HTTP ${response.status}`,
// //         };
// //       }

// //       return {
// //         success: true,
// //         data: data?.data,
// //         message:
// //           data?.message ||
// //           'Member mentioned successfully.',
// //       };
// //     } catch (error) {
// //       console.log('Mention User Error:', error);

// //       return {
// //         success: false,
// //         message:
// //           error?.message ||
// //           'Unable to mention the selected member.',
// //       };
// //     }
// //   };

// //   const getTaskMentions = async (taskId, token) => {
// //     if (!taskId) {
// //       return [];
// //     }

// //     try {
// //       const response = await fetch(
// //         `${BASE_URL}/Task/${taskId}/mentions`,
// //         {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         }
// //       );

// //       if (response.status === 401) {
// //         await goToLogin();
// //         return [];
// //       }

// //       const data = await parseResponse(response);

// //       console.log('Get Mentions Status:', response.status);
// //       console.log('Get Mentions Response:', data);

// //       if (response.ok && data?.success) {
// //         return Array.isArray(data?.data)
// //           ? data.data
// //           : [];
// //       }

// //       return [];
// //     } catch (error) {
// //       console.log('Get Task Mentions Error:', error);
// //       return [];
// //     }
// //   };

// //   const AddTask = async () => {
// //     if (!title.trim()) {
// //       Alert.alert('Error', 'Please enter task title.');
// //       return;
// //     }

// //     if (!description.trim()) {
// //       Alert.alert('Error', 'Please enter task description.');
// //       return;
// //     }

// //     const token = await AsyncStorage.getItem('token');

// //     if (!token) {
// //       Alert.alert(
// //         'Session Expired',
// //         'Please login again.',
// //         [
// //           {
// //             text: 'OK',
// //             onPress: goToLogin,
// //           },
// //         ]
// //       );
// //       return;
// //     }

// //     try {
// //       setLoading(true);

// //       const formattedDate = formatDueDate(date);
// //       const formattedTime = formatDueTime(date);

// //       const response = await fetch(
// //         `${BASE_URL}/Managment/task`,
// //         {
// //           method: 'POST',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //           body: JSON.stringify({
// //             title: title.trim(),
// //             description: description.trim(),
// //             dueDate: formattedDate,
// //             dueTime: formattedTime,
// //             isTimeBased: true,
// //             groupId: groupIdParam
// //               ? parseInt(groupIdParam, 10)
// //               : null,
// //           }),
// //         }
// //       );

// //       if (response.status === 401) {
// //         await goToLogin();
// //         return;
// //       }

// //       const responseData = await parseResponse(response);

// //       console.log(
// //         'Create Task Response Status:',
// //         response.status
// //       );

// //       console.log(
// //         'Create Task Response Body:',
// //         responseData
// //       );

// //       if (
// //         !response.ok ||
// //         !(
// //           responseData?.success ||
// //           response.status === 200 ||
// //           response.status === 201
// //         )
// //       ) {
// //         Alert.alert(
// //           'Error',
// //           responseData?.message ||
// //             `Failed to create task (HTTP ${response.status}).`
// //         );
// //         return;
// //       }

// //       const createdTaskId =
// //         getTaskIdFromResponse(responseData);

// //       let mentionResult = null;

// //       if (
// //         groupIdParam &&
// //         selectedMentionMember?.userId &&
// //         createdTaskId
// //       ) {
// //         mentionResult = await mentionUser(
// //           createdTaskId,
// //           selectedMentionMember,
// //           token
// //         );

// //         if (mentionResult.success) {
// //           const verifiedMentions =
// //             await getTaskMentions(
// //               createdTaskId,
// //               token
// //             );

// //           console.log(
// //             'Verified task mentions:',
// //             verifiedMentions
// //           );
// //         }
// //       }

// //       if (
// //         selectedMentionMember &&
// //         !createdTaskId
// //       ) {
// //         Alert.alert(
// //           'Task Created',
// //           'The task was created, but the task ID was not returned by the server, so the member could not be mentioned.'
// //         );

// //         navigation.goBack();
// //         return;
// //       }

// //       if (
// //         selectedMentionMember &&
// //         createdTaskId &&
// //         mentionResult &&
// //         !mentionResult.success
// //       ) {
// //         Alert.alert(
// //           'Task Created',
// //           `Task was created successfully, but ${selectedMentionMember.displayName} could not be mentioned.\n\n${mentionResult.message}`,
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => navigation.goBack(),
// //             },
// //           ]
// //         );

// //         return;
// //       }

// //       let successMessage =
// //         responseData?.message ||
// //         'Task created successfully.';

// //       if (
// //         mentionResult?.success &&
// //         selectedMentionMember
// //       ) {
// //         successMessage += `\n\n${selectedMentionMember.displayName} was mentioned successfully.`;
// //       }

// //       Alert.alert(
// //         'Success',
// //         successMessage,
// //         [
// //           {
// //             text: 'OK',
// //             onPress: () => navigation.goBack(),
// //           },
// //         ]
// //       );

// //       setTitle('');
// //       setDescription('');
// //       setDate(new Date());
// //       setSelectedMentionMember(null);
// //     } catch (error) {
// //       console.log('Add Task Error:', error);

// //       Alert.alert(
// //         'Error',
// //         error?.message ||
// //           'Server not reachable.'
// //       );
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleNonTimeBased = () => {
// //     setTaskType('non');

// //     navigation.navigate(
// //       'AddTaskNonTimeBased',
// //       {
// //         groupId: groupIdParam,
// //       }
// //     );
// //   };

// //   const renderMentionModal = () => {
// //     return (
// //       <Modal
// //         visible={showMentionModal}
// //         transparent
// //         animationType="slide"
// //         onRequestClose={() =>
// //           setShowMentionModal(false)
// //         }
// //       >
// //         <View style={styles.modalOverlay}>
// //           <View
// //             style={[
// //               styles.modalContainer,
// //               {
// //                 backgroundColor: cardBg,
// //               },
// //             ]}
// //           >
// //             <View style={styles.modalHeader}>
// //               <View style={styles.modalTitleContainer}>
// //                 <Icon
// //                   name="at-outline"
// //                   size={22}
// //                   color={primaryColor}
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.modalTitle,
// //                     { color: textColor },
// //                   ]}
// //                 >
// //                   Mention Group Member
// //                 </Text>
// //               </View>

// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setShowMentionModal(false)
// //                 }
// //                 style={[
// //                   styles.modalCloseButton,
// //                   { backgroundColor: inputBg },
// //                 ]}
// //               >
// //                 <Icon
// //                   name="close"
// //                   size={20}
// //                   color={textColor}
// //                 />
// //               </TouchableOpacity>
// //             </View>

// //             <Text
// //               style={[
// //                 styles.modalSubtitle,
// //                 { color: subTextColor },
// //               ]}
// //             >
// //               Select a registered group member to
// //               mention in this task.
// //             </Text>

// //             {membersLoading ? (
// //               <View style={styles.emptyContainer}>
// //                 <ActivityIndicator
// //                   size="small"
// //                   color={primaryColor}
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.emptyText,
// //                     { color: subTextColor },
// //                   ]}
// //                 >
// //                   Loading group members...
// //                 </Text>
// //               </View>
// //             ) : groupMembers.length === 0 ? (
// //               <View style={styles.emptyContainer}>
// //                 <Icon
// //                   name="people-outline"
// //                   size={40}
// //                   color={subTextColor}
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.emptyTitle,
// //                     { color: textColor },
// //                   ]}
// //                 >
// //                   No registered members
// //                 </Text>

// //                 <Text
// //                   style={[
// //                     styles.emptyText,
// //                     { color: subTextColor },
// //                   ]}
// //                 >
// //                   There are no registered group members
// //                   available to mention.
// //                 </Text>
// //               </View>
// //             ) : (
// //               <ScrollView
// //                 style={styles.memberList}
// //                 showsVerticalScrollIndicator={false}
// //               >
// //                 {groupMembers.map((member, index) => {
// //                   const isSelected =
// //                     selectedMentionMember?.userId ===
// //                     member.userId;

// //                   return (
// //                     <TouchableOpacity
// //                       key={`${member.userId}-${index}`}
// //                       style={[
// //                         styles.memberItem,
// //                         {
// //                           backgroundColor: isSelected
// //                             ? `${primaryColor}15`
// //                             : inputBg,
// //                           borderColor: isSelected
// //                             ? primaryColor
// //                             : borderClr,
// //                         },
// //                       ]}
// //                       onPress={() => {
// //                         setSelectedMentionMember(
// //                           member
// //                         );
// //                         setShowMentionModal(false);
// //                       }}
// //                       activeOpacity={0.7}
// //                     >
// //                       <View
// //                         style={[
// //                           styles.memberAvatar,
// //                           {
// //                             backgroundColor:
// //                               isSelected
// //                                 ? primaryColor
// //                                 : `${primaryColor}20`,
// //                           },
// //                         ]}
// //                       >
// //                         <Text
// //                           style={[
// //                             styles.memberAvatarText,
// //                             {
// //                               color: isSelected
// //                                 ? '#FFFFFF'
// //                                 : primaryColor,
// //                             },
// //                           ]}
// //                         >
// //                           {(
// //                             member.displayName?.charAt(
// //                               0
// //                             ) || 'M'
// //                           ).toUpperCase()}
// //                         </Text>
// //                       </View>

// //                       <View
// //                         style={
// //                           styles.memberInfo
// //                         }
// //                       >
// //                         <Text
// //                           style={[
// //                             styles.memberName,
// //                             { color: textColor },
// //                           ]}
// //                           numberOfLines={1}
// //                         >
// //                           {member.displayName}
// //                         </Text>

// //                         {!!member.phone && (
// //                           <Text
// //                             style={[
// //                               styles.memberPhone,
// //                               {
// //                                 color: subTextColor,
// //                               },
// //                             ]}
// //                             numberOfLines={1}
// //                           >
// //                             {member.phone}
// //                           </Text>
// //                         )}
// //                       </View>

// //                       {isSelected && (
// //                         <Icon
// //                           name="checkmark-circle"
// //                           size={24}
// //                           color={primaryColor}
// //                         />
// //                       )}
// //                     </TouchableOpacity>
// //                   );
// //                 })}
// //               </ScrollView>
// //             )}

// //             <TouchableOpacity
// //               style={[
// //                 styles.modalCancelButton,
// //                 {
// //                   borderColor: borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 setShowMentionModal(false)
// //               }
// //               activeOpacity={0.7}
// //             >
// //               <Text
// //                 style={[
// //                   styles.modalCancelText,
// //                   { color: textColor },
// //                 ]}
// //               >
// //                 CANCEL
// //               </Text>
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       </Modal>
// //     );
// //   };

// //   return (
// //     <SafeAreaView
// //       style={[
// //         styles.container,
// //         {
// //           backgroundColor:
// //             theme.bg || '#F8FAFC',
// //         },
// //       ]}
// //     >
// //       <StatusBar
// //         barStyle={
// //           isDark
// //             ? 'light-content'
// //             : 'dark-content'
// //         }
// //         backgroundColor={
// //           theme.bg || '#F8FAFC'
// //         }
// //         translucent={
// //           Platform.OS === 'android'
// //         }
// //       />

// //       <View
// //         style={[
// //           styles.header,
// //           {
// //             backgroundColor:
// //               theme.bg || '#F8FAFC',
// //             borderBottomColor: borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           onPress={() => navigation.goBack()}
// //           style={[
// //             styles.backBtn,
// //             { backgroundColor: inputBg },
// //           ]}
// //           activeOpacity={0.7}
// //           accessibilityRole="button"
// //           accessibilityLabel="Go back"
// //         >
// //           <Icon
// //             name="arrow-back"
// //             size={20}
// //             color={textColor}
// //           />
// //         </TouchableOpacity>

// //         <View
// //           style={[
// //             styles.headerBox,
// //             {
// //               backgroundColor:
// //                 theme.headerBox ||
// //                 inputBg,
// //             },
// //           ]}
// //         >
// //           <Text
// //             style={[
// //               styles.headerText,
// //               { color: textColor },
// //             ]}
// //           >
// //             New Task
// //           </Text>
// //         </View>

// //         <View style={styles.headerSpacer} />
// //       </View>

// //       <ScrollView
// //         contentContainerStyle={
// //           styles.content
// //         }
// //         showsVerticalScrollIndicator={false}
// //         keyboardShouldPersistTaps="handled"
// //       >
// //         <View style={styles.responsiveWrapper}>
// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Task Title
// //             </Text>

// //             <TextInput
// //               placeholder="e.g. System Architecture Design"
// //               placeholderTextColor={
// //                 subTextColor
// //               }
// //               style={[
// //                 styles.input,
// //                 {
// //                   color: textColor,
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor: borderClr,
// //                 },
// //               ]}
// //               value={title}
// //               onChangeText={setTitle}
// //               maxLength={200}
// //             />
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Description
// //             </Text>

// //             <TextInput
// //               placeholder="Provide detailed instructions or goals..."
// //               placeholderTextColor={
// //                 subTextColor
// //               }
// //               multiline
// //               numberOfLines={4}
// //               textAlignVertical="top"
// //               style={[
// //                 styles.input,
// //                 styles.descriptionInput,
// //                 {
// //                   color: textColor,
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor: borderClr,
// //                 },
// //               ]}
// //               value={description}
// //               onChangeText={setDescription}
// //             />
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Task Mode
// //             </Text>

// //             <View style={styles.radioRow}>
// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setTaskType('time')
// //                 }
// //                 style={[
// //                   styles.radioItem,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       taskType === 'time'
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={[
// //                     styles.radioOuter,
// //                     {
// //                       borderColor:
// //                         taskType === 'time'
// //                           ? primaryColor
// //                           : subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   {taskType === 'time' && (
// //                     <View
// //                       style={[
// //                         styles.radioInner,
// //                         {
// //                           backgroundColor:
// //                             primaryColor,
// //                         },
// //                       ]}
// //                     />
// //                   )}
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.radioText,
// //                     {
// //                       color: textColor,
// //                       fontWeight:
// //                         taskType === 'time'
// //                           ? '700'
// //                           : '500',
// //                     },
// //                   ]}
// //                 >
// //                   Time Based
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={
// //                   handleNonTimeBased
// //                 }
// //                 style={[
// //                   styles.radioItem,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       taskType === 'non'
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={[
// //                     styles.radioOuter,
// //                     {
// //                       borderColor:
// //                         taskType === 'non'
// //                           ? primaryColor
// //                           : subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   {taskType === 'non' && (
// //                     <View
// //                       style={[
// //                         styles.radioInner,
// //                         {
// //                           backgroundColor:
// //                             primaryColor,
// //                         },
// //                       ]}
// //                     />
// //                   )}
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.radioText,
// //                     {
// //                       color: textColor,
// //                       fontWeight:
// //                         taskType === 'non'
// //                           ? '700'
// //                           : '500',
// //                     },
// //                   ]}
// //                 >
// //                   Non-Time Based
// //                 </Text>
// //               </TouchableOpacity>
// //             </View>
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Date & Time Settings
// //             </Text>

// //             <View style={styles.calendarBox}>
// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setShowDate(true)
// //                 }
// //                 style={[
// //                   styles.dateRow,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={
// //                     styles.dateTimeInfo
// //                   }
// //                 >
// //                   <Icon
// //                     name="calendar-outline"
// //                     size={18}
// //                     color={primaryColor}
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.dateText,
// //                       {
// //                         color: textColor,
// //                       },
// //                     ]}
// //                   >
// //                     {date.toLocaleDateString()}
// //                   </Text>
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.changeText,
// //                     {
// //                       color: primaryColor,
// //                     },
// //                   ]}
// //                 >
// //                   Change Date
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setShowTime(true)
// //                 }
// //                 style={[
// //                   styles.dateRow,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={
// //                     styles.dateTimeInfo
// //                   }
// //                 >
// //                   <Icon
// //                     name="time-outline"
// //                     size={18}
// //                     color={primaryColor}
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.dateText,
// //                       {
// //                         color: textColor,
// //                       },
// //                     ]}
// //                   >
// //                     {date.toLocaleTimeString(
// //                       [],
// //                       {
// //                         hour: '2-digit',
// //                         minute: '2-digit',
// //                       }
// //                     )}
// //                   </Text>
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.changeText,
// //                     {
// //                       color: primaryColor,
// //                     },
// //                   ]}
// //                 >
// //                   Change Time
// //                 </Text>
// //               </TouchableOpacity>

// //               {showDate && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="date"
// //                   display={
// //                     Platform.OS === 'ios'
// //                       ? 'spinner'
// //                       : 'calendar'
// //                   }
// //                   onChange={
// //                     onChangeDate
// //                   }
// //                 />
// //               )}

// //               {showTime && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="time"
// //                   display={
// //                     Platform.OS === 'ios'
// //                       ? 'spinner'
// //                       : 'clock'
// //                   }
// //                   onChange={
// //                     onChangeTime
// //                   }
// //                 />
// //               )}
// //             </View>
// //           </View>

// //           {groupIdParam && (
// //             <View
// //               style={[
// //                 styles.card,
// //                 {
// //                   backgroundColor:
// //                     cardBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //             >
// //               <View
// //                 style={
// //                   styles.mentionHeader
// //                 }
// //               >
// //                 <View
// //                   style={
// //                     styles.mentionLabelContainer
// //                   }
// //                 >
// //                   <Icon
// //                     name="at-outline"
// //                     size={18}
// //                     color={primaryColor}
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.label,
// //                       styles.mentionLabel,
// //                       {
// //                         color:
// //                           primaryColor,
// //                       },
// //                     ]}
// //                   >
// //                     Mention Group Member
// //                   </Text>
// //                 </View>
// //               </View>

// //               <TouchableOpacity
// //                 style={[
// //                   styles.dropdown,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       selectedMentionMember
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 onPress={() =>
// //                   setShowMentionModal(true)
// //                 }
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={
// //                     styles.selectedMention
// //                   }
// //                 >
// //                   <View
// //                     style={[
// //                       styles.smallAvatar,
// //                       {
// //                         backgroundColor:
// //                           selectedMentionMember
// //                             ? primaryColor
// //                             : `${primaryColor}20`,
// //                       },
// //                     ]}
// //                   >
// //                     <Text
// //                       style={[
// //                         styles.smallAvatarText,
// //                         {
// //                           color:
// //                             selectedMentionMember
// //                               ? '#FFFFFF'
// //                               : primaryColor,
// //                         },
// //                       ]}
// //                     >
// //                       {selectedMentionMember
// //                         ? (
// //                             selectedMentionMember.displayName?.charAt(
// //                               0
// //                             ) || 'M'
// //                           ).toUpperCase()
// //                         : '@'}
// //                     </Text>
// //                   </View>

// //                   <View
// //                     style={
// //                       styles.selectedMentionInfo
// //                     }
// //                   >
// //                     <Text
// //                       style={[
// //                         styles.dropdownText,
// //                         {
// //                           color:
// //                             textColor,
// //                         },
// //                       ]}
// //                       numberOfLines={1}
// //                     >
// //                       {selectedMentionMember
// //                         ? selectedMentionMember.displayName
// //                         : 'Select a group member'}
// //                     </Text>

// //                     {selectedMentionMember && (
// //                       <Text
// //                         style={[
// //                           styles.mentionSubText,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         Will be mentioned after task creation
// //                       </Text>
// //                     )}
// //                   </View>
// //                 </View>

// //                 <Icon
// //                   name="chevron-down"
// //                   size={18}
// //                   color={subTextColor}
// //                 />
// //               </TouchableOpacity>

// //               {selectedMentionMember && (
// //                 <TouchableOpacity
// //                   style={
// //                     styles.removeMentionButton
// //                   }
// //                   onPress={() =>
// //                     setSelectedMentionMember(
// //                       null
// //                     )
// //                   }
// //                   activeOpacity={0.7}
// //                 >
// //                   <Icon
// //                     name="close-circle-outline"
// //                     size={16}
// //                     color="#EF4444"
// //                   />

// //                   <Text
// //                     style={
// //                       styles.removeMentionText
// //                     }
// //                   >
// //                     Remove mention
// //                   </Text>
// //                 </TouchableOpacity>
// //               )}

// //               <Text
// //                 style={[
// //                   styles.helperText,
// //                   {
// //                     color:
// //                       subTextColor,
// //                   },
// //                 ]}
// //               >
// //                 The selected member will receive a
// //                 notification when the task is created.
// //               </Text>
// //             </View>
// //           )}

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Assign Task To
// //             </Text>

// //             <TouchableOpacity
// //               style={[
// //                 styles.dropdown,
// //                 {
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 navigation.navigate(
// //                   'ForwardTaskTo'
// //                 )
// //               }
// //               activeOpacity={0.7}
// //             >
// //               <Text
// //                 style={[
// //                   styles.dropdownText,
// //                   {
// //                     color: textColor,
// //                   },
// //                 ]}
// //               >
// //                 Select Recipient / Group
// //               </Text>

// //               <Icon
// //                 name="chevron-down"
// //                 size={18}
// //                 color={subTextColor}
// //               />
// //             </TouchableOpacity>
// //           </View>

// //           <View style={styles.btnRow}>
// //             <TouchableOpacity
// //               style={[
// //                 styles.btn,
// //                 styles.cancelBtn,
// //                 {
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 navigation.goBack()
// //               }
// //               disabled={loading}
// //               activeOpacity={0.7}
// //             >
// //               <Text
// //                 style={[
// //                   styles.btnText,
// //                   { color: textColor },
// //                 ]}
// //               >
// //                 CANCEL
// //               </Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={[
// //                 styles.btn,
// //                 styles.submitBtn,
// //                 {
// //                   backgroundColor:
// //                     primaryColor,
// //                 },
// //                 loading &&
// //                   styles.btnDisabled,
// //               ]}
// //               onPress={AddTask}
// //               disabled={loading}
// //               activeOpacity={0.8}
// //             >
// //               {loading ? (
// //                 <ActivityIndicator
// //                   color="#FFFFFF"
// //                   size="small"
// //                 />
// //               ) : (
// //                 <Text
// //                   style={
// //                     styles.submitBtnText
// //                   }
// //                 >
// //                   ADD TASK
// //                 </Text>
// //               )}
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       </ScrollView>

// //       <View
// //         style={[
// //           styles.bottom,
// //           {
// //             backgroundColor:
// //               theme.bottomNav ||
// //               (isDark
// //                 ? '#1E293B'
// //                 : '#0F172A'),
// //             borderTopColor:
// //               borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'HomeDashboard'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="home-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             Home
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'AddMember'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="person-add-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             Members
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
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

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             History
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
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

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             Settings
// //           </Text>
// //         </TouchableOpacity>
// //       </View>

// //       {renderMentionModal()}
// //     </SafeAreaView>
// //   );
// // };

// // export default AddTaskTimeBased;

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //   },

// //   header: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingTop:
// //       Platform.OS === 'android'
// //         ? (StatusBar.currentHeight || 24) + 8
// //         : 12,
// //     paddingBottom: 12,
// //     borderBottomWidth: 1,
// //     zIndex: 10,
// //   },

// //   backBtn: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   headerBox: {
// //     paddingHorizontal: 20,
// //     paddingVertical: 6,
// //     borderRadius: 20,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   headerText: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     letterSpacing: 0.3,
// //   },

// //   headerSpacer: {
// //     width: 40,
// //   },

// //   content: {
// //     paddingHorizontal: 16,
// //     paddingTop: 16,
// //     paddingBottom: 110,
// //   },

// //   responsiveWrapper: {
// //     width: '100%',
// //     maxWidth: 600,
// //     alignSelf: 'center',
// //   },

// //   card: {
// //     borderRadius: 16,
// //     padding: 16,
// //     marginBottom: 16,
// //     borderWidth: 1,
// //     elevation: 1,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: 1,
// //     },
// //     shadowOpacity: 0.04,
// //     shadowRadius: 3,
// //   },

// //   label: {
// //     fontSize: 12,
// //     fontWeight: '700',
// //     textTransform: 'uppercase',
// //     letterSpacing: 0.8,
// //     marginBottom: 10,
// //   },

// //   input: {
// //     fontSize: 15,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },

// //   descriptionInput: {
// //     minHeight: 110,
// //   },

// //   radioRow: {
// //     flexDirection:
// //       width < 360
// //         ? 'column'
// //         : 'row',
// //     gap: 12,
// //   },

// //   radioItem: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     paddingVertical: 12,
// //     paddingHorizontal: 14,
// //     borderRadius: 12,
// //     borderWidth: 1.5,
// //     minHeight: 50,
// //   },

// //   radioOuter: {
// //     width: 20,
// //     height: 20,
// //     borderRadius: 10,
// //     borderWidth: 2,
// //     marginRight: 10,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   radioInner: {
// //     width: 10,
// //     height: 10,
// //     borderRadius: 5,
// //   },

// //   radioText: {
// //     fontSize: 14,
// //   },

// //   calendarBox: {
// //     gap: 10,
// //   },

// //   dateRow: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },

// //   dateTimeInfo: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 10,
// //   },

// //   dateText: {
// //     fontSize: 14,
// //     fontWeight: '600',
// //   },

// //   changeText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //   },

// //   dropdown: {
// //     borderRadius: 12,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderWidth: 1,
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     minHeight: 50,
// //   },

// //   dropdownText: {
// //     fontSize: 14,
// //     fontWeight: '500',
// //   },

// //   mentionHeader: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //   },

// //   mentionLabelContainer: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //   },

// //   mentionLabel: {
// //     marginBottom: 10,
// //     marginLeft: 7,
// //   },

// //   selectedMention: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     minWidth: 0,
// //   },

// //   smallAvatar: {
// //     width: 34,
// //     height: 34,
// //     borderRadius: 17,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     marginRight: 10,
// //   },

// //   smallAvatarText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //   },

// //   selectedMentionInfo: {
// //     flex: 1,
// //     minWidth: 0,
// //   },

// //   mentionSubText: {
// //     fontSize: 11,
// //     marginTop: 2,
// //   },

// //   removeMentionButton: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     alignSelf: 'flex-start',
// //     marginTop: 10,
// //     paddingVertical: 4,
// //   },

// //   removeMentionText: {
// //     color: '#EF4444',
// //     fontSize: 12,
// //     fontWeight: '600',
// //     marginLeft: 5,
// //   },

// //   helperText: {
// //     fontSize: 11,
// //     lineHeight: 16,
// //     marginTop: 10,
// //   },

// //   btnRow: {
// //     flexDirection: 'row',
// //     gap: 12,
// //     marginTop: 8,
// //   },

// //   btn: {
// //     flex: 1,
// //     paddingVertical: 14,
// //     borderRadius: 12,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     minHeight: 52,
// //   },

// //   cancelBtn: {
// //     backgroundColor: 'transparent',
// //     borderWidth: 1,
// //   },

// //   submitBtn: {
// //     elevation: 3,
// //     shadowColor: '#2563EB',
// //     shadowOffset: {
// //       width: 0,
// //       height: 3,
// //     },
// //     shadowOpacity: 0.3,
// //     shadowRadius: 5,
// //   },

// //   btnDisabled: {
// //     opacity: 0.6,
// //   },

// //   btnText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },

// //   submitBtnText: {
// //     color: '#FFFFFF',
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },

// //   bottom: {
// //     position: 'absolute',
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     height: 65,
// //     flexDirection: 'row',
// //     justifyContent: 'space-around',
// //     alignItems: 'center',
// //     borderTopWidth: 1,
// //     elevation: 10,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: -3,
// //     },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 4,
// //   },

// //   iconBtn: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 6,
// //     minHeight: 48,
// //   },

// //   bottomNavText: {
// //     color: '#94A3B8',
// //     fontSize: 10,
// //     fontWeight: '600',
// //     marginTop: 3,
// //   },

// //   modalOverlay: {
// //     flex: 1,
// //     backgroundColor: 'rgba(0, 0, 0, 0.55)',
// //     justifyContent: 'flex-end',
// //   },

// //   modalContainer: {
// //     width: '100%',
// //     maxHeight: '80%',
// //     borderTopLeftRadius: 24,
// //     borderTopRightRadius: 24,
// //     padding: 20,
// //   },

// //   modalHeader: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     marginBottom: 8,
// //   },

// //   modalTitleContainer: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     flex: 1,
// //   },

// //   modalTitle: {
// //     fontSize: 18,
// //     fontWeight: '700',
// //     marginLeft: 8,
// //   },

// //   modalCloseButton: {
// //     width: 36,
// //     height: 36,
// //     borderRadius: 18,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   modalSubtitle: {
// //     fontSize: 13,
// //     lineHeight: 19,
// //     marginBottom: 16,
// //   },

// //   memberList: {
// //     maxHeight: 420,
// //   },

// //   memberItem: {
// //     minHeight: 68,
// //     borderRadius: 14,
// //     borderWidth: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     paddingHorizontal: 12,
// //     marginBottom: 10,
// //   },

// //   memberAvatar: {
// //     width: 42,
// //     height: 42,
// //     borderRadius: 21,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     marginRight: 12,
// //   },

// //   memberAvatarText: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //   },

// //   memberInfo: {
// //     flex: 1,
// //     minWidth: 0,
// //   },

// //   memberName: {
// //     fontSize: 15,
// //     fontWeight: '700',
// //   },

// //   memberPhone: {
// //     fontSize: 12,
// //     marginTop: 3,
// //   },

// //   emptyContainer: {
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 40,
// //   },

// //   emptyTitle: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     marginTop: 10,
// //   },

// //   emptyText: {
// //     fontSize: 13,
// //     textAlign: 'center',
// //     marginTop: 6,
// //     lineHeight: 19,
// //   },

// //   modalCancelButton: {
// //     minHeight: 48,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     marginTop: 14,
// //   },

// //   modalCancelText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },
// // });







































// // import React, { useState } from 'react';
// // import {
// //   SafeAreaView,
// //   View,
// //   Text,
// //   StyleSheet,
// //   TouchableOpacity,
// //   TextInput,
// //   ScrollView,
// //   Alert,
// //   Platform,
// //   ActivityIndicator,
// //   StatusBar,
// //   Dimensions,
// // } from 'react-native';
// // import AsyncStorage from '@react-native-async-storage/async-storage';
// // import Icon from '@react-native-vector-icons/ionicons';
// // import DateTimePicker from '@react-native-community/datetimepicker';
// // import { useTheme } from '../../context/ThemeContext';
// // import { BASE_URL } from "../../config/api";

// // const { width } = Dimensions.get('window');

// // const AddTaskTimeBased = ({ navigation, route }) => {
// //   const { isDark, theme } = useTheme();

// //   const [taskType, setTaskType] = useState('time');
// //   const [title, setTitle] = useState('');
// //   const [description, setDescription] = useState('');

// //   const [date, setDate] = useState(new Date());
// //   const [showDate, setShowDate] = useState(false);
// //   const [showTime, setShowTime] = useState(false);

// //   const [loading, setLoading] = useState(false);

// //   const [groups, setGroups] = useState([]);
// //   const [selectedGroup, setSelectedGroup] = useState(null);

// //   const groupIdParam = route?.params?.groupId || null;

// //   React.useEffect(() => {
// //     const fetchGroups = async () => {
// //       try {
// //         const token = await AsyncStorage.getItem('token');
// //         const response = await fetch(`${BASE_URL}/Management/groups`, {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         });

// //         // Safe JSON Parsing
// //         const text = await response.text();
// //         const data = text ? JSON.parse(text) : {};

// //         if (response.ok && data?.success) {
// //           setGroups(data.data || []);
// //         }
// //       } catch (err) {
// //         console.log('Error fetching groups:', err);
// //       }
// //     };
// //     fetchGroups();
// //   }, []);

// //   // ✅ DATE HANDLER
// //   const onChangeDate = (event, selectedDate) => {
// //     if (Platform.OS === 'android') setShowDate(false);

// //     if (selectedDate) {
// //       const newDate = new Date(date);
// //       newDate.setFullYear(selectedDate.getFullYear());
// //       newDate.setMonth(selectedDate.getMonth());
// //       newDate.setDate(selectedDate.getDate());
// //       setDate(newDate);
// //     }
// //   };

// //   // ✅ TIME HANDLER
// //   const onChangeTime = (event, selectedTime) => {
// //     if (Platform.OS === 'android') setShowTime(false);

// //     if (selectedTime) {
// //       const newDate = new Date(date);
// //       newDate.setHours(selectedTime.getHours());
// //       newDate.setMinutes(selectedTime.getMinutes());
// //       setDate(newDate);
// //     }
// //   };

// //   // ✅ SAFE DATE & TIME FORMATTERS FOR ASP.NET (DateOnly & TimeOnly)
// //   const formatDueDate = (d) => {
// //     const year = d.getFullYear();
// //     const month = String(d.getMonth() + 1).padStart(2, '0');
// //     const day = String(d.getDate()).padStart(2, '0');
// //     return `${year}-${month}-${day}`;
// //   };

// //   const formatDueTime = (d) => {
// //     const hours = String(d.getHours()).padStart(2, '0');
// //     const minutes = String(d.getMinutes()).padStart(2, '0');
// //     const seconds = String(d.getSeconds()).padStart(2, '0');
// //     return `${hours}:${minutes}:${seconds}`;
// //   };

// //   // ✅ API FUNCTION
// //   const AddTask = async () => {
// //     if (!title.trim() || !description.trim()) {
// //       Alert.alert('Error', 'Please fill all fields');
// //       return;
// //     }

// //     const token = await AsyncStorage.getItem('token');

// //     if (!token) {
// //       Alert.alert(
// //         'Session Expired',
// //         'Please login again.',
// //         [
// //           {
// //             text: 'OK',
// //             onPress: () => navigation.replace('Login'),
// //           },
// //         ]
// //       );
// //       return;
// //     }

// //     try {
// //       setLoading(true);

// //       const formattedDate = formatDueDate(date); // YYYY-MM-DD
// //       const formattedTime = formatDueTime(date); // HH:mm:ss

// //       const response = await fetch(`${BASE_URL}/Managment/task`, {
// //         method: 'POST',
// //         headers: {
// //           'Content-Type': 'application/json',
// //           Authorization: `Bearer ${token}`,
// //         },
// //         body: JSON.stringify({
// //           title: title.trim(),
// //           description: description.trim(),
// //           dueDate: formattedDate,
// //           dueTime: formattedTime,
// //           isTimeBased: true,
// //           groupId: groupIdParam ? parseInt(groupIdParam, 10) : null,
// //         }),
// //       });

// //       // Safely handle empty response body
// //       const responseText = await response.text();
// //       let responseData = {};
      
// //       try {
// //         responseData = responseText ? JSON.parse(responseText) : {};
// //       } catch (e) {
// //         console.log('Failed to parse response JSON:', responseText);
// //       }

// //       console.log('Create Task Response Status:', response.status);
// //       console.log('Create Task Response Body:', responseData);

// //       if (response.ok && (responseData?.success || response.status === 200 || response.status === 201)) {
// //         Alert.alert(
// //           'Success',
// //           responseData?.message || 'Task created successfully.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => navigation.goBack(),
// //             },
// //           ]
// //         );

// //         setTitle('');
// //         setDescription('');
// //         setDate(new Date());
// //       } else {
// //         Alert.alert(
// //           'Error',
// //           responseData?.message || `Failed to create task (HTTP ${response.status}).`
// //         );
// //       }

// //     } catch (error) {
// //       console.log('Add Task Error:', error);

// //       Alert.alert(
// //         'Error',
// //         error.message || 'Server not reachable.'
// //       );

// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleNonTimeBased = () => {
// //     setTaskType('non');
// //     navigation.navigate('AddTaskNonTimeBased', { groupId: groupIdParam });
// //   };

// //   const primaryColor = theme.primary || '#2563EB';
// //   const cardBg = theme.card || '#FFFFFF';
// //   const textColor = theme.text || '#0F172A';
// //   const subTextColor = theme.subText || '#64748B';
// //   const borderClr = theme.border || '#E2E8F0';
// //   const inputBg = theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg || '#F8FAFC' }]}>
// //       <StatusBar
// //         barStyle={isDark ? 'light-content' : 'dark-content'}
// //         backgroundColor={theme.bg || '#F8FAFC'}
// //         translucent={Platform.OS === 'android'}
// //       />

// //       {/* HEADER */}
// //       <View style={[styles.header, { backgroundColor: theme.bg || '#F8FAFC', borderBottomColor: borderClr }]}>
// //         <TouchableOpacity 
// //           onPress={() => navigation.goBack()}
// //           style={[styles.backBtn, { backgroundColor: inputBg }]}
// //           activeOpacity={0.7}
// //           accessibilityRole="button"
// //           accessibilityLabel="Go back"
// //         >
// //           <Icon name="arrow-back" size={20} color={textColor} />
// //         </TouchableOpacity>

// //         <View style={[styles.headerBox, { backgroundColor: theme.headerBox || inputBg }]}>
// //           <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
// //         </View>

// //         <View style={styles.headerSpacer} />
// //       </View>

// //       <ScrollView 
// //         contentContainerStyle={styles.content}
// //         showsVerticalScrollIndicator={false}
// //         keyboardShouldPersistTaps="handled"
// //       >
// //         <View style={styles.responsiveWrapper}>
          
// //           {/* TITLE INPUT CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Task Title</Text>
// //             <TextInput
// //               placeholder="e.g. System Architecture Design"
// //               placeholderTextColor={subTextColor}
// //               style={[styles.input, { color: textColor, backgroundColor: inputBg, borderColor: borderClr }]}
// //               value={title}
// //               onChangeText={setTitle}
// //             />
// //           </View>

// //           {/* DESCRIPTION INPUT CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Description</Text>
// //             <TextInput
// //               placeholder="Provide detailed instructions or goals..."
// //               placeholderTextColor={subTextColor}
// //               multiline
// //               numberOfLines={4}
// //               textAlignVertical="top"
// //               style={[
// //                 styles.input,
// //                 styles.descriptionInput,
// //                 { color: textColor, backgroundColor: inputBg, borderColor: borderClr },
// //               ]}
// //               value={description}
// //               onChangeText={setDescription}
// //             />
// //           </View>

// //           {/* TASK MODE SELECTOR CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Task Mode</Text>
// //             <View style={styles.radioRow}>
// //               <TouchableOpacity
// //                 onPress={() => setTaskType('time')}
// //                 style={[
// //                   styles.radioItem,
// //                   { backgroundColor: inputBg, borderColor: taskType === 'time' ? primaryColor : borderClr },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={[styles.radioOuter, { borderColor: taskType === 'time' ? primaryColor : subTextColor }]}>
// //                   {taskType === 'time' && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
// //                 </View>
// //                 <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === 'time' ? '700' : '500' }]}>
// //                   Time Based
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={handleNonTimeBased}
// //                 style={[
// //                   styles.radioItem,
// //                   { backgroundColor: inputBg, borderColor: taskType === 'non' ? primaryColor : borderClr },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={[styles.radioOuter, { borderColor: taskType === 'non' ? primaryColor : subTextColor }]}>
// //                   {taskType === 'non' && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
// //                 </View>
// //                 <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === 'non' ? '700' : '500' }]}>
// //                   Non-Time Based
// //                 </Text>
// //               </TouchableOpacity>
// //             </View>
// //           </View>

// //           {/* DATE & TIME CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Date & Time Settings</Text>

// //             <View style={styles.calendarBox}>
// //               <TouchableOpacity
// //                 onPress={() => setShowDate(true)}
// //                 style={[styles.dateRow, { backgroundColor: inputBg, borderColor: borderClr }]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={styles.dateTimeInfo}>
// //                   <Icon name="calendar-outline" size={18} color={primaryColor} />
// //                   <Text style={[styles.dateText, { color: textColor }]}>
// //                     {date.toLocaleDateString()}
// //                   </Text>
// //                 </View>
// //                 <Text style={[styles.changeText, { color: primaryColor }]}>Change Date</Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={() => setShowTime(true)}
// //                 style={[styles.dateRow, { backgroundColor: inputBg, borderColor: borderClr }]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={styles.dateTimeInfo}>
// //                   <Icon name="time-outline" size={18} color={primaryColor} />
// //                   <Text style={[styles.dateText, { color: textColor }]}>
// //                     {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
// //                   </Text>
// //                 </View>
// //                 <Text style={[styles.changeText, { color: primaryColor }]}>Change Time</Text>
// //               </TouchableOpacity>

// //               {showDate && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="date"
// //                   display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
// //                   onChange={onChangeDate}
// //                 />
// //               )}

// //               {showTime && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="time"
// //                   display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
// //                   onChange={onChangeTime}
// //                 />
// //               )}
// //             </View>
// //           </View>

// //           {/* RECIPIENT DROPDOWN CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Assign Task To</Text>
// //             <TouchableOpacity
// //               style={[styles.dropdown, { backgroundColor: inputBg, borderColor: borderClr }]}
// //               onPress={() => navigation.navigate("ForwardTaskTo")}
// //               activeOpacity={0.7}
// //             >
// //               <Text style={[styles.dropdownText, { color: textColor }]}>Select Recipient / Group</Text>
// //               <Icon name="chevron-down" size={18} color={subTextColor} />
// //             </TouchableOpacity>
// //           </View>

// //           {/* ACTION BUTTONS */}
// //           <View style={styles.btnRow}>
// //             <TouchableOpacity
// //               style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
// //               onPress={() => navigation.goBack()}
// //               disabled={loading}
// //               activeOpacity={0.7}
// //             >
// //               <Text style={[styles.btnText, { color: textColor }]}>CANCEL</Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={[
// //                 styles.btn,
// //                 styles.submitBtn,
// //                 { backgroundColor: primaryColor },
// //                 loading && styles.btnDisabled,
// //               ]}
// //               onPress={AddTask}
// //               disabled={loading}
// //               activeOpacity={0.8}
// //             >
// //               {loading ? (
// //                 <ActivityIndicator color="#FFFFFF" size="small" />
// //               ) : (
// //                 <Text style={styles.submitBtnText}>ADD TASK</Text>
// //               )}
// //             </TouchableOpacity>
// //           </View>

// //         </View>
// //       </ScrollView>

// //       {/* BOTTOM NAV */}
// //       <View
// //         style={[
// //           styles.bottom,
// //           {
// //             backgroundColor: theme.bottomNav || (isDark ? '#1E293B' : '#0F172A'),
// //             borderTopColor: borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('HomeDashboard')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="home-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>Home</Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('AddMember')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="person-add-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>Members</Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="time-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>History</Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('SettingScreen')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="settings-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>Settings</Text>
// //         </TouchableOpacity>
// //       </View>
// //     </SafeAreaView>
// //   );
// // };

// // export default AddTaskTimeBased;

// // const styles = StyleSheet.create({
// //   container: { flex: 1 },
// //   header: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
// //     paddingBottom: 12,
// //     borderBottomWidth: 1,
// //     zIndex: 10,
// //   },
// //   backBtn: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },
// //   headerBox: {
// //     paddingHorizontal: 20,
// //     paddingVertical: 6,
// //     borderRadius: 20,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },
// //   headerText: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     letterSpacing: 0.3,
// //   },
// //   headerSpacer: { width: 40 },
// //   content: {
// //     paddingHorizontal: 16,
// //     paddingTop: 16,
// //     paddingBottom: 110,
// //   },
// //   responsiveWrapper: {
// //     width: '100%',
// //     maxWidth: 600,
// //     alignSelf: 'center',
// //   },
// //   card: {
// //     borderRadius: 16,
// //     padding: 16,
// //     marginBottom: 16,
// //     borderWidth: 1,
// //     elevation: 1,
// //     shadowColor: '#000',
// //     shadowOffset: { width: 0, height: 1 },
// //     shadowOpacity: 0.04,
// //     shadowRadius: 3,
// //   },
// //   label: {
// //     fontSize: 12,
// //     fontWeight: '700',
// //     textTransform: 'uppercase',
// //     letterSpacing: 0.8,
// //     marginBottom: 10,
// //   },
// //   input: {
// //     fontSize: 15,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },
// //   descriptionInput: { minHeight: 110 },
// //   radioRow: {
// //     flexDirection: width < 360 ? 'column' : 'row',
// //     gap: 12,
// //   },
// //   radioItem: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     paddingVertical: 12,
// //     paddingHorizontal: 14,
// //     borderRadius: 12,
// //     borderWidth: 1.5,
// //     minHeight: 50,
// //   },
// //   radioOuter: {
// //     width: 20,
// //     height: 20,
// //     borderRadius: 10,
// //     borderWidth: 2,
// //     marginRight: 10,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },
// //   radioInner: {
// //     width: 10,
// //     height: 10,
// //     borderRadius: 5,
// //   },
// //   radioText: { fontSize: 14 },
// //   calendarBox: { gap: 10 },
// //   dateRow: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },
// //   dateTimeInfo: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 10,
// //   },
// //   dateText: {
// //     fontSize: 14,
// //     fontWeight: '600',
// //   },
// //   changeText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //   },
// //   dropdown: {
// //     borderRadius: 12,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderWidth: 1,
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     minHeight: 50,
// //   },
// //   dropdownText: {
// //     fontSize: 14,
// //     fontWeight: '500',
// //   },
// //   btnRow: {
// //     flexDirection: 'row',
// //     gap: 12,
// //     marginTop: 8,
// //   },
// //   btn: {
// //     flex: 1,
// //     paddingVertical: 14,
// //     borderRadius: 12,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     minHeight: 52,
// //   },
// //   cancelBtn: {
// //     backgroundColor: 'transparent',
// //     borderWidth: 1,
// //   },
// //   submitBtn: {
// //     elevation: 3,
// //     shadowColor: '#2563EB',
// //     shadowOffset: { width: 0, height: 3 },
// //     shadowOpacity: 0.3,
// //     shadowRadius: 5,
// //   },
// //   btnDisabled: { opacity: 0.6 },
// //   btnText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },
// //   submitBtnText: {
// //     color: '#FFFFFF',
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },
// //   bottom: {
// //     position: 'absolute',
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     height: 65,
// //     flexDirection: 'row',
// //     justifyContent: 'space-around',
// //     alignItems: 'center',
// //     borderTopWidth: 1,
// //     elevation: 10,
// //     shadowColor: '#000',
// //     shadowOffset: { width: 0, height: -3 },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 4,
// //   },
// //   iconBtn: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 6,
// //     minHeight: 48,
// //   },
// //   bottomNavText: {
// //     color: '#94A3B8',
// //     fontSize: 10,
// //     fontWeight: '600',
// //     marginTop: 3,
// //   },
// // });
































// // // import React, { useState } from 'react';
// // // import {
// // //   SafeAreaView,
// // //   View,
// // //   Text,
// // //   StyleSheet,
// // //   TouchableOpacity,
// // //   TextInput,
// // //   ScrollView,
// // //   Alert,
// // //   Platform,
// // //   ActivityIndicator,
// // // } from 'react-native';
// // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // import Icon from 'react-native-vector-icons/Ionicons';
// // // import DateTimePicker from '@react-native-community/datetimepicker';
// // // import { apiClient } from '../../utils/apiClient';
// // // import { useTheme } from '../../context/ThemeContext';


// // // const AddTaskTimeBased = ({ navigation, route }) => {
// // //   const { isDark, theme } = useTheme();

// // //   const [taskType, setTaskType] = useState('time');
// // //   const [title, setTitle] = useState('');
// // //   const [description, setDescription] = useState('');

// // //   const [date, setDate] = useState(new Date());
// // //   const [showDate, setShowDate] = useState(false);
// // //   const [showTime, setShowTime] = useState(false);

// // //   const [loading, setLoading] = useState(false);

// // //   const [groups, setGroups] = useState([]);
// // //   const [selectedGroup, setSelectedGroup] = useState(null);
// // //   const [showGroupDropdown, setShowGroupDropdown] = useState(false);

// // //   const groupIdParam = route?.params?.groupId || null;

// // //   React.useEffect(() => {
// // //     const fetchGroups = async () => {
// // //       try {
// // //         const response = await apiClient('/groups');
// // //         if (response && response.success) setGroups(response.data || []);
// // //       } catch (err) {}
// // //     };
// // //     fetchGroups();
// // //   }, []);

// // //   // ✅ DATE HANDLER
// // //   const onChangeDate = (event, selectedDate) => {
// // //     if (Platform.OS === 'android') setShowDate(false);

// // //     if (selectedDate) {
// // //       const newDate = new Date(date);
// // //       newDate.setFullYear(selectedDate.getFullYear());
// // //       newDate.setMonth(selectedDate.getMonth());
// // //       newDate.setDate(selectedDate.getDate());
// // //       setDate(newDate);
// // //     }
// // //   };

// // //   // ✅ TIME HANDLER
// // //   const onChangeTime = (event, selectedTime) => {
// // //     if (Platform.OS === 'android') setShowTime(false);

// // //     if (selectedTime) {
// // //       const newDate = new Date(date);
// // //       newDate.setHours(selectedTime.getHours());
// // //       newDate.setMinutes(selectedTime.getMinutes());
// // //       setDate(newDate);
// // //     }
// // //   };

// // //   // ✅ API FUNCTION
// // //   const AddTask = async () => {
// // //     // Validation
// // //     if (!title.trim() || !description.trim()) {
// // //       Alert.alert("Error", "Please fill all fields");
// // //       return;
// // //     }

// // //     // Check login
// // //     const token = await AsyncStorage.getItem("token");

// // //     if (!token) {
// // //       Alert.alert(
// // //         "Session Expired",
// // //         "Please login again.",
// // //         [
// // //           {
// // //             text: "OK",
// // //             onPress: () => navigation.replace("Login"),
// // //           },
// // //         ]
// // //       );
// // //       return;
// // //     }

// // //     try {
// // //       setLoading(true);

// // //       const response = await apiClient("/tasks", {
// // //         method: "POST",
// // //         body: JSON.stringify({
// // //           title: title.trim(),
// // //           description: description.trim(),
// // //           dueDate:
// // //             date.getFullYear() +
// // //             "-" +
// // //             String(date.getMonth() + 1).padStart(2, "0") +
// // //             "-" +
// // //             String(date.getDate()).padStart(2, "0"),
// // //           dueTime:
// // //             String(date.getHours()).padStart(2, "0") +
// // //             ":" +
// // //             String(date.getMinutes()).padStart(2, "0"),
// // //           isTimeBased: true,
// // //           groupId: groupIdParam,
// // //         }),
// // //       });

// // //       console.log("Create Task Response:", response);

// // //       if (response?.success) {
// // //         Alert.alert(
// // //           "Success",
// // //           response.message || "Task created successfully.",
// // //           [
// // //             {
// // //               text: "OK",
// // //               onPress: () => navigation.goBack(),
// // //             },
// // //           ]
// // //         );

// // //         setTitle("");
// // //         setDescription("");
// // //         setDate(new Date());

// // //       } else {
// // //         Alert.alert(
// // //           "Error",
// // //           response?.message || "Failed to create task."
// // //         );
// // //       }

// // //     } catch (error) {
// // //       console.log("Add Task Error:", error);

// // //       Alert.alert(
// // //         "Error",
// // //         error.message || "Server not reachable."
// // //       );

// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   const handleNonTimeBased = () => {
// // //     setTaskType('non');
// // //     navigation.navigate('AddTaskNonTimeBased', { groupId: groupIdParam });
// // //   };

// // //   return (
// // //     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
// // //       <ScrollView contentContainerStyle={styles.content}>

// // //         {/* HEADER */}
// // //         <View style={styles.header}>
// // //           <TouchableOpacity onPress={() => navigation.goBack()}>
// // //             <Icon name="arrow-back" size={22} color={theme.text} />
// // //           </TouchableOpacity>

// // //           <View style={[styles.headerBox, { backgroundColor: theme.headerBox }]}>
// // //             <Text style={[styles.headerText, { color: theme.text }]}>ADD-TASK</Text>
// // //           </View>

// // //           <View style={{ width: 22 }} />
// // //         </View>

// // //         {/* TITLE */}
// // //         <View style={[styles.card, { backgroundColor: theme.card }]}>
// // //           <Text style={[styles.label, { color: theme.text }]}>TITLE:</Text>
// // //           <TextInput value={title} onChangeText={setTitle} />
// // //         </View>

// // //         {/* DESCRIPTION */}
// // //         <View style={[styles.card, { height: 120 }, { backgroundColor: theme.card }]}>
// // //           <Text style={[styles.label, { color: theme.text }]}>DESCRIPTION</Text>
// // //           <TextInput
// // //             multiline
// // //             value={description}
// // //             onChangeText={setDescription}
// // //           />
// // //         </View>

// // //         {/* TYPE */}
// // //         <Text style={[styles.section, { color: theme.text }]}>TIME BASED & NON TIME BASED:</Text>

// // //         <View style={styles.radioRow}>
// // //           <TouchableOpacity onPress={() => setTaskType('time')} style={styles.radioItem}>
// // //             <View style={styles.radioOuter}>
// // //               {taskType === 'time' && <View style={styles.radioInner} />}
// // //             </View>
// // //             <Text style={{ color: theme.text }}>TIME BASED</Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity onPress={handleNonTimeBased} style={styles.radioItem}>
// // //             <View style={styles.radioOuter}>
// // //               {taskType === 'non' && <View style={styles.radioInner} />}
// // //             </View>
// // //             <Text style={{ color: theme.text }}>NON-TIME BASED</Text>
// // //           </TouchableOpacity>
// // //         </View>

// // //         {/* DATE & TIME */}
// // //         <Text style={[styles.section, { color: theme.text }]}>DATE & TIME</Text>

// // //         <View style={styles.calendarBox}>

// // //           {/* DATE */}
// // //           <TouchableOpacity onPress={() => setShowDate(true)} style={styles.dateRow}>
// // //             <Text style={[styles.dateText, { color: theme.text }]}>
// // //               {date.toLocaleDateString()}
// // //             </Text>
// // //             <Icon name="calendar-outline" size={18} color={theme.text} />
// // //           </TouchableOpacity>

// // //           {/* TIME */}
// // //           <TouchableOpacity onPress={() => setShowTime(true)} style={styles.dateRow}>
// // //             <Text style={[styles.dateText, { color: theme.text }]}>
// // //               {date.toLocaleTimeString()}
// // //             </Text>
// // //             <Icon name="time-outline" size={18} color={theme.text} />
// // //           </TouchableOpacity>

// // //           {/* DATE PICKER */}
// // //           {showDate && (
// // //             <DateTimePicker
// // //               value={date}
// // //               mode="date"
// // //               display="calendar"
// // //               onChange={onChangeDate}
// // //             />
// // //           )}

// // //           {/* TIME PICKER */}
// // //           {showTime && (
// // //             <DateTimePicker
// // //               value={date}
// // //               mode="time"
// // //               display="spinner"
// // //               onChange={onChangeTime}
// // //             />
// // //           )}

// // //         </View>

// // //         {/* DROPDOWN */}
// // //         <TouchableOpacity
// // //           style={styles.dropdown}
// // //           onPress={() => navigation.navigate("ForwardTaskTo")}
// // //         >
// // //           <Text style={{ fontWeight: '600' }}>ADD TASK FOR</Text>
// // //           <Icon name="chevron-down" size={18} color={theme.text} />
// // //         </TouchableOpacity>

// // //         {/* BUTTONS */}
// // //         <View style={styles.btnRow}>
// // //           <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
// // //             <Text style={styles.btnText}>CANCEL</Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity style={styles.btn} onPress={AddTask}>
// // //             {loading ? (
// // //               <ActivityIndicator color="#fff" />
// // //             ) : (
// // //               <Text style={styles.btnText}>ADD</Text>
// // //             )}
// // //           </TouchableOpacity>
// // //         </View>

// // //       </ScrollView>

// // //       {/* BOTTOM NAV */}
// // //       <View style={[styles.bottom, { backgroundColor: theme.bottomNav }]}>
// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('HomeDashboard')}>
// // //           <Icon name="home" size={24} color="#fff" />
// // //         </TouchableOpacity>

// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddMember')}>
// // //           <Icon name="person-add" size={24} color="#fff" />
// // //         </TouchableOpacity>

// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('TimeBasedHistoryScreen')}>
// // //           <Icon name="time" size={24} color="#fff" />
// // //         </TouchableOpacity>

// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SettingScreen')}>
// // //           <Icon name="settings" size={24} color="#fff" />
// // //         </TouchableOpacity>
// // //       </View>

// // //     </SafeAreaView>
// // //   );
// // // };

// // // export default AddTaskTimeBased;

// // // const styles = StyleSheet.create({
// // //   container: { flex: 1, backgroundColor: '#B7C9DB' },
// // //   content: { padding: 20, paddingBottom: 120 },

// // //   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
// // //   headerBox: { backgroundColor: '#fff', padding: 10, borderRadius: 10 },
// // //   headerText: { fontWeight: '800' },

// // //   card: { backgroundColor: '#EDEDED', borderRadius: 12, padding: 14, marginTop: 18 },
// // //   label: { fontWeight: '800' },

// // //   section: { marginTop: 20, fontWeight: '800' },

// // //   radioRow: { flexDirection: 'row', marginTop: 10 },
// // //   radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },

// // //   radioOuter: {
// // //     width: 18,
// // //     height: 18,
// // //     borderRadius: 9,
// // //     borderWidth: 2,
// // //     marginRight: 6,
// // //     alignItems: 'center',
// // //     justifyContent: 'center'
// // //   },

// // //   radioInner: { width: 8, height: 8, backgroundColor: '#000', borderRadius: 4 },

// // //   calendarBox: {
// // //     marginTop: 10,
// // //     backgroundColor: '#EDEDED',
// // //     borderRadius: 10,
// // //     padding: 10
// // //   },

// // //   dateRow: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     paddingVertical: 12
// // //   },

// // //   dateText: { fontSize: 14 },

// // //   dropdown: {
// // //     marginTop: 20,
// // //     backgroundColor: '#EDEDED',
// // //     borderRadius: 25,
// // //     padding: 14,
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between'
// // //   },

// // //   btnRow: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     marginTop: 30
// // //   },

// // //   btn: {
// // //     width: '45%',
// // //     backgroundColor: '#000',
// // //     padding: 14,
// // //     borderRadius: 30,
// // //     alignItems: 'center'
// // //   },

// // //   btnText: { color: '#fff', fontWeight: '800' },

// // //   bottom: {
// // //     position: 'absolute',
// // //     bottom: 0,
// // //     width: '100%',
// // //     height: 65,
// // //     backgroundColor: '#3A3F45',
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-around',
// // //     alignItems: 'center'
// // //   },

// // //   iconBtn: {
// // //     flex: 1,
// // //     alignItems: 'center',
// // //     justifyContent: 'center'
// // //   },
// // // });

















































// import React, { useEffect, useState } from 'react';
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
//   StatusBar,
//   Dimensions,
//   Modal,
// } from 'react-native';

// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Icon from '@react-native-vector-icons/ionicons';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import { useTheme } from '../../context/ThemeContext';
// import { BASE_URL } from '../../config/api';

// const { width } = Dimensions.get('window');

// const AddTaskTimeBased = ({ navigation, route }) => {
//   const { isDark, theme } = useTheme();

//   const [taskType, setTaskType] = useState('time');

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');

//   const [date, setDate] = useState(new Date());
//   const [showDate, setShowDate] = useState(false);
//   const [showTime, setShowTime] = useState(false);

//   const [loading, setLoading] = useState(false);

//   const [groupMembers, setGroupMembers] = useState([]);
//   const [selectedMentionMember, setSelectedMentionMember] = useState(null);
//   const [showMentionModal, setShowMentionModal] = useState(false);
//   const [membersLoading, setMembersLoading] = useState(false);

//   const groupIdParam = route?.params?.groupId || null;

//   const primaryColor = theme.primary || '#2563EB';
//   const cardBg = theme.card || '#FFFFFF';
//   const textColor = theme.text || '#0F172A';
//   const subTextColor = theme.subText || '#64748B';
//   const borderClr = theme.border || '#E2E8F0';
//   const inputBg =
//     theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

//   const goToLogin = async () => {
//     await AsyncStorage.removeItem('token');

//     navigation.reset({
//       index: 0,
//       routes: [
//         {
//           name: 'AuthStack',
//           state: {
//             routes: [{ name: 'Login' }],
//           },
//         },
//       ],
//     });
//   };

//   const parseResponse = async (response) => {
//     const text = await response.text();

//     if (!text) {
//       return {};
//     }

//     try {
//       return JSON.parse(text);
//     } catch (error) {
//       return {
//         message: text,
//       };
//     }
//   };

//   const getTaskIdFromResponse = (data) => {
//     return (
//       data?.data?.id ??
//       data?.data?.taskId ??
//       data?.taskId ??
//       data?.id ??
//       null
//     );
//   };

//   useEffect(() => {
//     const fetchGroupMembers = async () => {
//       if (!groupIdParam) {
//         setGroupMembers([]);
//         return;
//       }

//       try {
//         setMembersLoading(true);

//         const token = await AsyncStorage.getItem('token');

//         if (!token) {
//           return;
//         }

//         const response = await fetch(`${BASE_URL}/Task/groups`, {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         });

//         if (response.status === 401) {
//           await goToLogin();
//           return;
//         }

//         const data = await parseResponse(response);

//         if (!response.ok) {
//           console.log(
//             'Failed to fetch group members:',
//             data?.message
//           );
//           return;
//         }

//         const groupsData = Array.isArray(data?.data)
//           ? data.data
//           : [];

//         const currentGroup = groupsData.find(
//           (group) =>
//             String(group?.id ?? group?.groupId) ===
//             String(groupIdParam)
//         );

//         const members = Array.isArray(currentGroup?.members)
//           ? currentGroup.members
//           : [];

//         const normalizedMembers = members
//           .map((member) => {
//             const userId =
//               member?.userId ??
//               member?.id ??
//               member?.UserId ??
//               null;

//             const firstName =
//               member?.firstName ??
//               member?.FirstName ??
//               '';

//             const lastName =
//               member?.lastName ??
//               member?.LastName ??
//               '';

//             const displayName =
//               member?.displayName ??
//               member?.name ??
//               member?.fullName ??
//               `${firstName} ${lastName}`.trim();

//             return {
//               ...member,
//               userId:
//                 userId !== null
//                   ? Number(userId)
//                   : null,
//               displayName:
//                 displayName ||
//                 member?.phone ||
//                 member?.PhoneNumber ||
//                 'Group Member',
//               phone:
//                 member?.phone ??
//                 member?.PhoneNumber ??
//                 '',
//               isRegistered:
//                 member?.isRegistered !== false &&
//                 userId !== null &&
//                 Number(userId) > 0,
//             };
//           })
//           .filter(
//             (member) =>
//               member.isRegistered &&
//               Number(member.userId) > 0
//           );

//         setGroupMembers(normalizedMembers);
//       } catch (error) {
//         console.log('Error fetching group members:', error);
//       } finally {
//         setMembersLoading(false);
//       }
//     };

//     fetchGroupMembers();
//   }, [groupIdParam]);

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

//   const formatDueDate = (d) => {
//     const year = d.getFullYear();
//     const month = String(d.getMonth() + 1).padStart(2, '0');
//     const day = String(d.getDate()).padStart(2, '0');

//     return `${year}-${month}-${day}`;
//   };

//   const formatDueTime = (d) => {
//     const hours = String(d.getHours()).padStart(2, '0');
//     const minutes = String(d.getMinutes()).padStart(2, '0');
//     const seconds = String(d.getSeconds()).padStart(2, '0');

//     return `${hours}:${minutes}:${seconds}`;
//   };

//   const mentionUser = async (taskId, member, token) => {
//     if (!taskId || !member?.userId) {
//       return {
//         success: false,
//         message: 'No member selected for mention.',
//       };
//     }

//     try {
//       const response = await fetch(
//         `${BASE_URL}/Task/${taskId}/mention`,
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             mentionedUserId: Number(member.userId),
//           }),
//         }
//       );

//       if (response.status === 401) {
//         await goToLogin();

//         return {
//           success: false,
//           message: 'Session expired.',
//         };
//       }

//       const data = await parseResponse(response);

//       console.log('Mention API Status:', response.status);
//       console.log('Mention API Response:', data);

//       if (!response.ok || !data?.success) {
//         return {
//           success: false,
//           message:
//             data?.message ||
//             `Failed to mention member. HTTP ${response.status}`,
//         };
//       }

//       return {
//         success: true,
//         data: data?.data,
//         message:
//           data?.message ||
//           'Member mentioned successfully.',
//       };
//     } catch (error) {
//       console.log('Mention User Error:', error);

//       return {
//         success: false,
//         message:
//           error?.message ||
//           'Unable to mention the selected member.',
//       };
//     }
//   };

//   const getTaskMentions = async (taskId, token) => {
//     if (!taskId) {
//       return [];
//     }

//     try {
//       const response = await fetch(
//         `${BASE_URL}/Task/${taskId}/mentions`,
//         {
//           method: 'GET',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (response.status === 401) {
//         await goToLogin();
//         return [];
//       }

//       const data = await parseResponse(response);

//       console.log('Get Mentions Status:', response.status);
//       console.log('Get Mentions Response:', data);

//       if (response.ok && data?.success) {
//         return Array.isArray(data?.data)
//           ? data.data
//           : [];
//       }

//       return [];
//     } catch (error) {
//       console.log('Get Task Mentions Error:', error);
//       return [];
//     }
//   };

//   const AddTask = async () => {
//     if (!title.trim()) {
//       Alert.alert('Error', 'Please enter task title.');
//       return;
//     }

//     if (!description.trim()) {
//       Alert.alert('Error', 'Please enter task description.');
//       return;
//     }

//     const token = await AsyncStorage.getItem('token');

//     if (!token) {
//       Alert.alert(
//         'Session Expired',
//         'Please login again.',
//         [
//           {
//             text: 'OK',
//             onPress: goToLogin,
//           },
//         ]
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const formattedDate = formatDueDate(date);
//       const formattedTime = formatDueTime(date);

//       const response = await fetch(
//         `${BASE_URL}/Managment/task`,
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: title.trim(),
//             description: description.trim(),
//             dueDate: formattedDate,
//             dueTime: formattedTime,
//             isTimeBased: true,
//             groupId: groupIdParam
//               ? parseInt(groupIdParam, 10)
//               : null,
//           }),
//         }
//       );

//       if (response.status === 401) {
//         await goToLogin();
//         return;
//       }

//       const responseData = await parseResponse(response);

//       console.log(
//         'Create Task Response Status:',
//         response.status
//       );

//       console.log(
//         'Create Task Response Body:',
//         responseData
//       );

//       if (
//         !response.ok ||
//         !(
//           responseData?.success ||
//           response.status === 200 ||
//           response.status === 201
//         )
//       ) {
//         Alert.alert(
//           'Error',
//           responseData?.message ||
//             `Failed to create task (HTTP ${response.status}).`
//         );
//         return;
//       }

//       const createdTaskId =
//         getTaskIdFromResponse(responseData);

//       let mentionResult = null;

//       if (
//         groupIdParam &&
//         selectedMentionMember?.userId &&
//         createdTaskId
//       ) {
//         mentionResult = await mentionUser(
//           createdTaskId,
//           selectedMentionMember,
//           token
//         );

//         if (mentionResult.success) {
//           const verifiedMentions =
//             await getTaskMentions(
//               createdTaskId,
//               token
//             );

//           console.log(
//             'Verified task mentions:',
//             verifiedMentions
//           );
//         }
//       }

//       if (
//         selectedMentionMember &&
//         !createdTaskId
//       ) {
//         Alert.alert(
//           'Task Created',
//           'The task was created, but the task ID was not returned by the server, so the member could not be mentioned.'
//         );

//         navigation.goBack();
//         return;
//       }

//       if (
//         selectedMentionMember &&
//         createdTaskId &&
//         mentionResult &&
//         !mentionResult.success
//       ) {
//         Alert.alert(
//           'Task Created',
//           `Task was created successfully, but ${selectedMentionMember.displayName} could not be mentioned.\n\n${mentionResult.message}`,
//           [
//             {
//               text: 'OK',
//               onPress: () => navigation.goBack(),
//             },
//           ]
//         );

//         return;
//       }

//       let successMessage =
//         responseData?.message ||
//         'Task created successfully.';

//       if (
//         mentionResult?.success &&
//         selectedMentionMember
//       ) {
//         successMessage += `\n\n${selectedMentionMember.displayName} was mentioned successfully.`;
//       }

//       Alert.alert(
//         'Success',
//         successMessage,
//         [
//           {
//             text: 'OK',
//             onPress: () => navigation.goBack(),
//           },
//         ]
//       );

//       setTitle('');
//       setDescription('');
//       setDate(new Date());
//       setSelectedMentionMember(null);
//     } catch (error) {
//       console.log('Add Task Error:', error);

//       Alert.alert(
//         'Error',
//         error?.message ||
//           'Server not reachable.'
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleNonTimeBased = () => {
//     setTaskType('non');

//     navigation.navigate(
//       'AddTaskNonTimeBased',
//       {
//         groupId: groupIdParam,
//       }
//     );
//   };

//   const renderMentionModal = () => {
//     return (
//       <Modal
//         visible={showMentionModal}
//         transparent
//         animationType="slide"
//         onRequestClose={() =>
//           setShowMentionModal(false)
//         }
//       >
//         <View style={styles.modalOverlay}>
//           <View
//             style={[
//               styles.modalContainer,
//               {
//                 backgroundColor: cardBg,
//               },
//             ]}
//           >
//             <View style={styles.modalHeader}>
//               <View style={styles.modalTitleContainer}>
//                 <Icon
//                   name="at-outline"
//                   size={22}
//                   color={primaryColor}
//                 />

//                 <Text
//                   style={[
//                     styles.modalTitle,
//                     { color: textColor },
//                   ]}
//                 >
//                   Mention Group Member
//                 </Text>
//               </View>

//               <TouchableOpacity
//                 onPress={() =>
//                   setShowMentionModal(false)
//                 }
//                 style={[
//                   styles.modalCloseButton,
//                   { backgroundColor: inputBg },
//                 ]}
//               >
//                 <Icon
//                   name="close"
//                   size={20}
//                   color={textColor}
//                 />
//               </TouchableOpacity>
//             </View>

//             <Text
//               style={[
//                 styles.modalSubtitle,
//                 { color: subTextColor },
//               ]}
//             >
//               Select a registered group member to
//               mention in this task.
//             </Text>

//             {membersLoading ? (
//               <View style={styles.emptyContainer}>
//                 <ActivityIndicator
//                   size="small"
//                   color={primaryColor}
//                 />

//                 <Text
//                   style={[
//                     styles.emptyText,
//                     { color: subTextColor },
//                   ]}
//                 >
//                   Loading group members...
//                 </Text>
//               </View>
//             ) : groupMembers.length === 0 ? (
//               <View style={styles.emptyContainer}>
//                 <Icon
//                   name="people-outline"
//                   size={40}
//                   color={subTextColor}
//                 />

//                 <Text
//                   style={[
//                     styles.emptyTitle,
//                     { color: textColor },
//                   ]}
//                 >
//                   No registered members
//                 </Text>

//                 <Text
//                   style={[
//                     styles.emptyText,
//                     { color: subTextColor },
//                   ]}
//                 >
//                   There are no registered group members
//                   available to mention.
//                 </Text>
//               </View>
//             ) : (
//               <ScrollView
//                 style={styles.memberList}
//                 showsVerticalScrollIndicator={false}
//               >
//                 {groupMembers.map((member, index) => {
//                   const isSelected =
//                     selectedMentionMember?.userId ===
//                     member.userId;

//                   return (
//                     <TouchableOpacity
//                       key={`${member.userId}-${index}`}
//                       style={[
//                         styles.memberItem,
//                         {
//                           backgroundColor: isSelected
//                             ? `${primaryColor}15`
//                             : inputBg,
//                           borderColor: isSelected
//                             ? primaryColor
//                             : borderClr,
//                         },
//                       ]}
//                       onPress={() => {
//                         setSelectedMentionMember(member);
//                         setShowMentionModal(false);
//                       }}
//                       activeOpacity={0.7}
//                     >
//                       <View
//                         style={[
//                           styles.memberAvatar,
//                           {
//                             backgroundColor:
//                               isSelected
//                                 ? primaryColor
//                                 : `${primaryColor}20`,
//                           },
//                         ]}
//                       >
//                         <Text
//                           style={[
//                             styles.memberAvatarText,
//                             {
//                               color: isSelected
//                                 ? '#FFFFFF'
//                                 : primaryColor,
//                             },
//                           ]}
//                         >
//                           {(
//                             member.displayName?.charAt(
//                               0
//                             ) || 'M'
//                           ).toUpperCase()}
//                         </Text>
//                       </View>

//                       <View
//                         style={styles.memberInfo}
//                       >
//                         <Text
//                           style={[
//                             styles.memberName,
//                             { color: textColor },
//                           ]}
//                           numberOfLines={1}
//                         >
//                           {member.displayName}
//                         </Text>

//                         {!!member.phone && (
//                           <Text
//                             style={[
//                               styles.memberPhone,
//                               {
//                                 color: subTextColor,
//                               },
//                             ]}
//                             numberOfLines={1}
//                           >
//                             {member.phone}
//                           </Text>
//                         )}
//                       </View>

//                       {isSelected && (
//                         <Icon
//                           name="checkmark-circle"
//                           size={24}
//                           color={primaryColor}
//                         />
//                       )}
//                     </TouchableOpacity>
//                   );
//                 })}
//               </ScrollView>
//             )}

//             <TouchableOpacity
//               style={[
//                 styles.modalCancelButton,
//                 {
//                   borderColor: borderClr,
//                 },
//               ]}
//               onPress={() =>
//                 setShowMentionModal(false)
//               }
//               activeOpacity={0.7}
//             >
//               <Text
//                 style={[
//                   styles.modalCancelText,
//                   { color: textColor },
//                 ]}
//               >
//                 CANCEL
//               </Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     );
//   };

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         {
//           backgroundColor:
//             theme.bg || '#F8FAFC',
//         },
//       ]}
//     >
//       <StatusBar
//         barStyle={
//           isDark
//             ? 'light-content'
//             : 'dark-content'
//         }
//         backgroundColor={
//           theme.bg || '#F8FAFC'
//         }
//         translucent={
//           Platform.OS === 'android'
//         }
//       />

//       <View
//         style={[
//           styles.header,
//           {
//             backgroundColor:
//               theme.bg || '#F8FAFC',
//             borderBottomColor: borderClr,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={[
//             styles.backBtn,
//             { backgroundColor: inputBg },
//           ]}
//           activeOpacity={0.7}
//           accessibilityRole="button"
//           accessibilityLabel="Go back"
//         >
//           <Icon
//             name="arrow-back"
//             size={20}
//             color={textColor}
//           />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             {
//               backgroundColor:
//                 theme.headerBox ||
//                 inputBg,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.headerText,
//               { color: textColor },
//             ]}
//           >
//             New Task
//           </Text>
//         </View>

//         <View style={styles.headerSpacer} />
//       </View>

//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
//       >
//         <View style={styles.responsiveWrapper}>
//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Task Title
//             </Text>

//             <TextInput
//               placeholder="e.g. System Architecture Design"
//               placeholderTextColor={subTextColor}
//               style={[
//                 styles.input,
//                 {
//                   color: textColor,
//                   backgroundColor: inputBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//               value={title}
//               onChangeText={setTitle}
//               maxLength={200}
//             />
//           </View>

//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Description
//             </Text>

//             <TextInput
//               placeholder="Provide detailed instructions or goals..."
//               placeholderTextColor={subTextColor}
//               multiline
//               numberOfLines={4}
//               textAlignVertical="top"
//               style={[
//                 styles.input,
//                 styles.descriptionInput,
//                 {
//                   color: textColor,
//                   backgroundColor: inputBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//               value={description}
//               onChangeText={setDescription}
//             />
//           </View>

//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Task Mode
//             </Text>

//             <View style={styles.radioRow}>
//               <TouchableOpacity
//                 onPress={() => setTaskType('time')}
//                 style={[
//                   styles.radioItem,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       taskType === 'time'
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View
//                   style={[
//                     styles.radioOuter,
//                     {
//                       borderColor:
//                         taskType === 'time'
//                           ? primaryColor
//                           : subTextColor,
//                     },
//                   ]}
//                 >
//                   {taskType === 'time' && (
//                     <View
//                       style={[
//                         styles.radioInner,
//                         {
//                           backgroundColor:
//                             primaryColor,
//                         },
//                       ]}
//                     />
//                   )}
//                 </View>

//                 <Text
//                   style={[
//                     styles.radioText,
//                     {
//                       color: textColor,
//                       fontWeight:
//                         taskType === 'time'
//                           ? '700'
//                           : '500',
//                     },
//                   ]}
//                 >
//                   Time Based
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 onPress={handleNonTimeBased}
//                 style={[
//                   styles.radioItem,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       taskType === 'non'
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View
//                   style={[
//                     styles.radioOuter,
//                     {
//                       borderColor:
//                         taskType === 'non'
//                           ? primaryColor
//                           : subTextColor,
//                     },
//                   ]}
//                 >
//                   {taskType === 'non' && (
//                     <View
//                       style={[
//                         styles.radioInner,
//                         {
//                           backgroundColor:
//                             primaryColor,
//                         },
//                       ]}
//                     />
//                   )}
//                 </View>

//                 <Text
//                   style={[
//                     styles.radioText,
//                     {
//                       color: textColor,
//                       fontWeight:
//                         taskType === 'non'
//                           ? '700'
//                           : '500',
//                     },
//                   ]}
//                 >
//                   Non-Time Based
//                 </Text>
//               </TouchableOpacity>
//             </View>
//           </View>

//           <View
//             style={[
//               styles.card,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderClr,
//               },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.label,
//                 { color: primaryColor },
//               ]}
//             >
//               Date & Time Settings
//             </Text>

//             <View style={styles.calendarBox}>
//               <TouchableOpacity
//                 onPress={() => setShowDate(true)}
//                 style={[
//                   styles.dateRow,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor: borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View style={styles.dateTimeInfo}>
//                   <Icon
//                     name="calendar-outline"
//                     size={18}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.dateText,
//                       {
//                         color: textColor,
//                       },
//                     ]}
//                   >
//                     {date.toLocaleDateString()}
//                   </Text>
//                 </View>

//                 <Text
//                   style={[
//                     styles.changeText,
//                     {
//                       color: primaryColor,
//                     },
//                   ]}
//                 >
//                   Change Date
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 onPress={() => setShowTime(true)}
//                 style={[
//                   styles.dateRow,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor: borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//               >
//                 <View style={styles.dateTimeInfo}>
//                   <Icon
//                     name="time-outline"
//                     size={18}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.dateText,
//                       {
//                         color: textColor,
//                       },
//                     ]}
//                   >
//                     {date.toLocaleTimeString([], {
//                       hour: '2-digit',
//                       minute: '2-digit',
//                     })}
//                   </Text>
//                 </View>

//                 <Text
//                   style={[
//                     styles.changeText,
//                     {
//                       color: primaryColor,
//                     },
//                   ]}
//                 >
//                   Change Time
//                 </Text>
//               </TouchableOpacity>

//               {showDate && (
//                 <DateTimePicker
//                   value={date}
//                   mode="date"
//                   display={
//                     Platform.OS === 'ios'
//                       ? 'spinner'
//                       : 'calendar'
//                   }
//                   onChange={onChangeDate}
//                 />
//               )}

//               {showTime && (
//                 <DateTimePicker
//                   value={date}
//                   mode="time"
//                   display={
//                     Platform.OS === 'ios'
//                       ? 'spinner'
//                       : 'clock'
//                   }
//                   onChange={onChangeTime}
//                 />
//               )}
//             </View>
//           </View>

//           {groupIdParam && (
//             <View
//               style={[
//                 styles.card,
//                 {
//                   backgroundColor: cardBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//             >
//               <View style={styles.mentionHeader}>
//                 <View style={styles.mentionLabelContainer}>
//                   <Icon
//                     name="at-outline"
//                     size={18}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.label,
//                       styles.mentionLabel,
//                       {
//                         color: primaryColor,
//                       },
//                     ]}
//                   >
//                     Mention Group Member
//                   </Text>
//                 </View>
//               </View>

//               <TouchableOpacity
//                 style={[
//                   styles.dropdown,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       selectedMentionMember
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 onPress={() =>
//                   setShowMentionModal(true)
//                 }
//                 activeOpacity={0.7}
//               >
//                 <View style={styles.selectedMention}>
//                   <View
//                     style={[
//                       styles.smallAvatar,
//                       {
//                         backgroundColor:
//                           selectedMentionMember
//                             ? primaryColor
//                             : `${primaryColor}20`,
//                       },
//                     ]}
//                   >
//                     <Text
//                       style={[
//                         styles.smallAvatarText,
//                         {
//                           color:
//                             selectedMentionMember
//                               ? '#FFFFFF'
//                               : primaryColor,
//                         },
//                       ]}
//                     >
//                       {selectedMentionMember
//                         ? (
//                             selectedMentionMember.displayName?.charAt(
//                               0
//                             ) || 'M'
//                           ).toUpperCase()
//                         : '@'}
//                     </Text>
//                   </View>

//                   <View
//                     style={styles.selectedMentionInfo}
//                   >
//                     <Text
//                       style={[
//                         styles.dropdownText,
//                         {
//                           color: textColor,
//                         },
//                       ]}
//                       numberOfLines={1}
//                     >
//                       {selectedMentionMember
//                         ? selectedMentionMember.displayName
//                         : 'Select a group member'}
//                     </Text>

//                     {selectedMentionMember && (
//                       <Text
//                         style={[
//                           styles.mentionSubText,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         Will be mentioned after task creation
//                       </Text>
//                     )}
//                   </View>
//                 </View>

//                 <Icon
//                   name="chevron-down"
//                   size={18}
//                   color={subTextColor}
//                 />
//               </TouchableOpacity>

//               {selectedMentionMember && (
//                 <TouchableOpacity
//                   style={styles.removeMentionButton}
//                   onPress={() =>
//                     setSelectedMentionMember(null)
//                   }
//                   activeOpacity={0.7}
//                 >
//                   <Icon
//                     name="close-circle-outline"
//                     size={16}
//                     color="#EF4444"
//                   />

//                   <Text
//                     style={styles.removeMentionText}
//                   >
//                     Remove mention
//                   </Text>
//                 </TouchableOpacity>
//               )}

//               <Text
//                 style={[
//                   styles.helperText,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 The selected member will receive a
//                 notification when the task is created.
//               </Text>
//             </View>
//           )}

//           <View style={styles.btnRow}>
//             <TouchableOpacity
//               style={[
//                 styles.btn,
//                 styles.cancelBtn,
//                 {
//                   borderColor: borderClr,
//                 },
//               ]}
//               onPress={() => navigation.goBack()}
//               disabled={loading}
//               activeOpacity={0.7}
//             >
//               <Text
//                 style={[
//                   styles.btnText,
//                   { color: textColor },
//                 ]}
//               >
//                 CANCEL
//               </Text>
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={[
//                 styles.btn,
//                 styles.submitBtn,
//                 {
//                   backgroundColor: primaryColor,
//                 },
//                 loading && styles.btnDisabled,
//               ]}
//               onPress={AddTask}
//               disabled={loading}
//               activeOpacity={0.8}
//             >
//               {loading ? (
//                 <ActivityIndicator
//                   color="#FFFFFF"
//                   size="small"
//                 />
//               ) : (
//                 <Text style={styles.submitBtnText}>
//                   ADD TASK
//                 </Text>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>
//       </ScrollView>

//       <View
//         style={[
//           styles.bottom,
//           {
//             backgroundColor:
//               theme.bottomNav ||
//               (isDark
//                 ? '#1E293B'
//                 : '#0F172A'),
//             borderTopColor: borderClr,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('HomeDashboard')
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="home-outline"
//             size={22}
//             color="#94A3B8"
//           />

//           <Text style={styles.bottomNavText}>
//             Home
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('AddMember')
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="person-add-outline"
//             size={22}
//             color="#94A3B8"
//           />

//           <Text style={styles.bottomNavText}>
//             Members
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
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

//           <Text style={styles.bottomNavText}>
//             History
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate('SettingScreen')
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="settings-outline"
//             size={22}
//             color="#94A3B8"
//           />

//           <Text style={styles.bottomNavText}>
//             Settings
//           </Text>
//         </TouchableOpacity>
//       </View>

//       {renderMentionModal()}
//     </SafeAreaView>
//   );
// };

// export default AddTaskTimeBased;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingTop:
//       Platform.OS === 'android'
//         ? (StatusBar.currentHeight || 24) + 8
//         : 12,
//     paddingBottom: 12,
//     borderBottomWidth: 1,
//     zIndex: 10,
//   },

//   backBtn: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   headerBox: {
//     paddingHorizontal: 20,
//     paddingVertical: 6,
//     borderRadius: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   headerText: {
//     fontSize: 16,
//     fontWeight: '700',
//     letterSpacing: 0.3,
//   },

//   headerSpacer: {
//     width: 40,
//   },

//   content: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 110,
//   },

//   responsiveWrapper: {
//     width: '100%',
//     maxWidth: 600,
//     alignSelf: 'center',
//   },

//   card: {
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 16,
//     borderWidth: 1,
//     elevation: 1,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 1,
//     },
//     shadowOpacity: 0.04,
//     shadowRadius: 3,
//   },

//   label: {
//     fontSize: 12,
//     fontWeight: '700',
//     textTransform: 'uppercase',
//     letterSpacing: 0.8,
//     marginBottom: 10,
//   },

//   input: {
//     fontSize: 15,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//     minHeight: 50,
//   },

//   descriptionInput: {
//     minHeight: 110,
//   },

//   radioRow: {
//     flexDirection:
//       width < 360
//         ? 'column'
//         : 'row',
//     gap: 12,
//   },

//   radioItem: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: 12,
//     paddingHorizontal: 14,
//     borderRadius: 12,
//     borderWidth: 1.5,
//     minHeight: 50,
//   },

//   radioOuter: {
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     borderWidth: 2,
//     marginRight: 10,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   radioInner: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//   },

//   radioText: {
//     fontSize: 14,
//   },

//   calendarBox: {
//     gap: 10,
//   },

//   dateRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//     minHeight: 50,
//   },

//   dateTimeInfo: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },

//   dateText: {
//     fontSize: 14,
//     fontWeight: '600',
//   },

//   changeText: {
//     fontSize: 13,
//     fontWeight: '700',
//   },

//   dropdown: {
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderWidth: 1,
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     minHeight: 50,
//   },

//   dropdownText: {
//     fontSize: 14,
//     fontWeight: '500',
//   },

//   mentionHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   mentionLabelContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   mentionLabel: {
//     marginBottom: 10,
//     marginLeft: 7,
//   },

//   selectedMention: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     minWidth: 0,
//   },

//   smallAvatar: {
//     width: 34,
//     height: 34,
//     borderRadius: 17,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 10,
//   },

//   smallAvatarText: {
//     fontSize: 14,
//     fontWeight: '700',
//   },

//   selectedMentionInfo: {
//     flex: 1,
//     minWidth: 0,
//   },

//   mentionSubText: {
//     fontSize: 11,
//     marginTop: 2,
//   },

//   removeMentionButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     alignSelf: 'flex-start',
//     marginTop: 10,
//     paddingVertical: 4,
//   },

//   removeMentionText: {
//     color: '#EF4444',
//     fontSize: 12,
//     fontWeight: '600',
//     marginLeft: 5,
//   },

//   helperText: {
//     fontSize: 11,
//     lineHeight: 16,
//     marginTop: 10,
//   },

//   btnRow: {
//     flexDirection: 'row',
//     gap: 12,
//     marginTop: 8,
//   },

//   btn: {
//     flex: 1,
//     paddingVertical: 14,
//     borderRadius: 12,
//     alignItems: 'center',
//     justifyContent: 'center',
//     minHeight: 52,
//   },

//   cancelBtn: {
//     backgroundColor: 'transparent',
//     borderWidth: 1,
//   },

//   submitBtn: {
//     elevation: 3,
//     shadowColor: '#2563EB',
//     shadowOffset: {
//       width: 0,
//       height: 3,
//     },
//     shadowOpacity: 0.3,
//     shadowRadius: 5,
//   },

//   btnDisabled: {
//     opacity: 0.6,
//   },

//   btnText: {
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },

//   submitBtnText: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },

//   bottom: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 65,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     borderTopWidth: 1,
//     elevation: 10,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: -3,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 6,
//     minHeight: 48,
//   },

//   bottomNavText: {
//     color: '#94A3B8',
//     fontSize: 10,
//     fontWeight: '600',
//     marginTop: 3,
//   },

//   modalOverlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.55)',
//     justifyContent: 'flex-end',
//   },

//   modalContainer: {
//     width: '100%',
//     maxHeight: '80%',
//     borderTopLeftRadius: 24,
//     borderTopRightRadius: 24,
//     padding: 20,
//   },

//   modalHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 8,
//   },

//   modalTitleContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//   },

//   modalTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     marginLeft: 8,
//   },

//   modalCloseButton: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },

//   modalSubtitle: {
//     fontSize: 13,
//     lineHeight: 19,
//     marginBottom: 16,
//   },

//   memberList: {
//     maxHeight: 420,
//   },

//   memberItem: {
//     minHeight: 68,
//     borderRadius: 14,
//     borderWidth: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 12,
//     marginBottom: 10,
//   },

//   memberAvatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 21,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 12,
//   },

//   memberAvatarText: {
//     fontSize: 16,
//     fontWeight: '700',
//   },

//   memberInfo: {
//     flex: 1,
//     minWidth: 0,
//   },

//   memberName: {
//     fontSize: 15,
//     fontWeight: '700',
//   },

//   memberPhone: {
//     fontSize: 12,
//     marginTop: 3,
//   },

//   emptyContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 40,
//   },

//   emptyTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//     marginTop: 10,
//   },

//   emptyText: {
//     fontSize: 13,
//     textAlign: 'center',
//     marginTop: 6,
//     lineHeight: 19,
//   },

//   modalCancelButton: {
//     minHeight: 48,
//     borderRadius: 12,
//     borderWidth: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 14,
//   },

//   modalCancelText: {
//     fontSize: 13,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
// });



































// // import React, { useEffect, useState } from 'react';
// // import {
// //   SafeAreaView,
// //   View,
// //   Text,
// //   StyleSheet,
// //   TouchableOpacity,
// //   TextInput,
// //   ScrollView,
// //   Alert,
// //   Platform,
// //   ActivityIndicator,
// //   StatusBar,
// //   Dimensions,
// //   Modal,
// // } from 'react-native';

// // import AsyncStorage from '@react-native-async-storage/async-storage';
// // import Icon from '@react-native-vector-icons/ionicons';
// // import DateTimePicker from '@react-native-community/datetimepicker';
// // import { useTheme } from '../../context/ThemeContext';
// // import { BASE_URL } from '../../config/api';

// // const { width } = Dimensions.get('window');

// // const AddTaskTimeBased = ({ navigation, route }) => {
// //   const { isDark, theme } = useTheme();

// //   const [taskType, setTaskType] = useState('time');

// //   const [title, setTitle] = useState('');
// //   const [description, setDescription] = useState('');

// //   const [date, setDate] = useState(new Date());
// //   const [showDate, setShowDate] = useState(false);
// //   const [showTime, setShowTime] = useState(false);

// //   const [loading, setLoading] = useState(false);

// //   const [groups, setGroups] = useState([]);
// //   const [selectedGroup, setSelectedGroup] = useState(null);

// //   const [groupMembers, setGroupMembers] = useState([]);
// //   const [selectedMentionMember, setSelectedMentionMember] = useState(null);
// //   const [showMentionModal, setShowMentionModal] = useState(false);
// //   const [membersLoading, setMembersLoading] = useState(false);

// //   const groupIdParam = route?.params?.groupId || null;

// //   const primaryColor = theme.primary || '#2563EB';
// //   const cardBg = theme.card || '#FFFFFF';
// //   const textColor = theme.text || '#0F172A';
// //   const subTextColor = theme.subText || '#64748B';
// //   const borderClr = theme.border || '#E2E8F0';
// //   const inputBg =
// //     theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

// //   const goToLogin = async () => {
// //     await AsyncStorage.removeItem('token');

// //     navigation.reset({
// //       index: 0,
// //       routes: [
// //         {
// //           name: 'AuthStack',
// //           state: {
// //             routes: [{ name: 'Login' }],
// //           },
// //         },
// //       ],
// //     });
// //   };

// //   const parseResponse = async (response) => {
// //     const text = await response.text();

// //     if (!text) {
// //       return {};
// //     }

// //     try {
// //       return JSON.parse(text);
// //     } catch (error) {
// //       return {
// //         message: text,
// //       };
// //     }
// //   };

// //   const getTaskIdFromResponse = (data) => {
// //     return (
// //       data?.data?.id ??
// //       data?.data?.taskId ??
// //       data?.taskId ??
// //       data?.id ??
// //       null
// //     );
// //   };

// //   useEffect(() => {
// //     const fetchGroups = async () => {
// //       try {
// //         const token = await AsyncStorage.getItem('token');

// //         if (!token) {
// //           return;
// //         }

// //         const response = await fetch(`${BASE_URL}/Management/groups`, {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         });

// //         if (response.status === 401) {
// //           await goToLogin();
// //           return;
// //         }

// //         const data = await parseResponse(response);

// //         if (response.ok && data?.success) {
// //           const groupList = Array.isArray(data?.data)
// //             ? data.data
// //             : [];

// //           setGroups(groupList);

// //           if (groupIdParam) {
// //             const foundGroup = groupList.find(
// //               (group) =>
// //                 String(group?.id ?? group?.groupId) ===
// //                 String(groupIdParam)
// //             );

// //             if (foundGroup) {
// //               setSelectedGroup(foundGroup);
// //             }
// //           }
// //         }
// //       } catch (error) {
// //         console.log('Error fetching groups:', error);
// //       }
// //     };

// //     fetchGroups();
// //   }, [groupIdParam]);

// //   useEffect(() => {
// //     const fetchGroupMembers = async () => {
// //       if (!groupIdParam) {
// //         setGroupMembers([]);
// //         return;
// //       }

// //       try {
// //         setMembersLoading(true);

// //         const token = await AsyncStorage.getItem('token');

// //         if (!token) {
// //           return;
// //         }

// //         const response = await fetch(`${BASE_URL}/Task/groups`, {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         });

// //         if (response.status === 401) {
// //           await goToLogin();
// //           return;
// //         }

// //         const data = await parseResponse(response);

// //         if (!response.ok) {
// //           console.log(
// //             'Failed to fetch group members:',
// //             data?.message
// //           );
// //           return;
// //         }

// //         const groupsData = Array.isArray(data?.data)
// //           ? data.data
// //           : [];

// //         const currentGroup = groupsData.find(
// //           (group) =>
// //             String(group?.id ?? group?.groupId) ===
// //             String(groupIdParam)
// //         );

// //         const members = Array.isArray(currentGroup?.members)
// //           ? currentGroup.members
// //           : [];

// //         const normalizedMembers = members
// //           .map((member) => {
// //             const userId =
// //               member?.userId ??
// //               member?.id ??
// //               member?.UserId ??
// //               null;

// //             const firstName =
// //               member?.firstName ??
// //               member?.FirstName ??
// //               '';

// //             const lastName =
// //               member?.lastName ??
// //               member?.LastName ??
// //               '';

// //             const displayName =
// //               member?.displayName ??
// //               member?.name ??
// //               member?.fullName ??
// //               `${firstName} ${lastName}`.trim();

// //             return {
// //               ...member,
// //               userId:
// //                 userId !== null
// //                   ? Number(userId)
// //                   : null,
// //               displayName:
// //                 displayName ||
// //                 member?.phone ||
// //                 member?.PhoneNumber ||
// //                 'Group Member',
// //               phone:
// //                 member?.phone ??
// //                 member?.PhoneNumber ??
// //                 '',
// //               isRegistered:
// //                 member?.isRegistered !== false &&
// //                 userId !== null &&
// //                 Number(userId) > 0,
// //             };
// //           })
// //           .filter(
// //             (member) =>
// //               member.isRegistered &&
// //               Number(member.userId) > 0
// //           );

// //         setGroupMembers(normalizedMembers);
// //       } catch (error) {
// //         console.log('Error fetching group members:', error);
// //       } finally {
// //         setMembersLoading(false);
// //       }
// //     };

// //     fetchGroupMembers();
// //   }, [groupIdParam]);

// //   const onChangeDate = (event, selectedDate) => {
// //     if (Platform.OS === 'android') {
// //       setShowDate(false);
// //     }

// //     if (selectedDate) {
// //       const newDate = new Date(date);

// //       newDate.setFullYear(selectedDate.getFullYear());
// //       newDate.setMonth(selectedDate.getMonth());
// //       newDate.setDate(selectedDate.getDate());

// //       setDate(newDate);
// //     }
// //   };

// //   const onChangeTime = (event, selectedTime) => {
// //     if (Platform.OS === 'android') {
// //       setShowTime(false);
// //     }

// //     if (selectedTime) {
// //       const newDate = new Date(date);

// //       newDate.setHours(selectedTime.getHours());
// //       newDate.setMinutes(selectedTime.getMinutes());
// //       newDate.setSeconds(0);
// //       newDate.setMilliseconds(0);

// //       setDate(newDate);
// //     }
// //   };

// //   const formatDueDate = (d) => {
// //     const year = d.getFullYear();
// //     const month = String(d.getMonth() + 1).padStart(2, '0');
// //     const day = String(d.getDate()).padStart(2, '0');

// //     return `${year}-${month}-${day}`;
// //   };

// //   const formatDueTime = (d) => {
// //     const hours = String(d.getHours()).padStart(2, '0');
// //     const minutes = String(d.getMinutes()).padStart(2, '0');
// //     const seconds = String(d.getSeconds()).padStart(2, '0');

// //     return `${hours}:${minutes}:${seconds}`;
// //   };

// //   const mentionUser = async (taskId, member, token) => {
// //     if (!taskId || !member?.userId) {
// //       return {
// //         success: false,
// //         message: 'No member selected for mention.',
// //       };
// //     }

// //     try {
// //       const response = await fetch(
// //         `${BASE_URL}/Task/${taskId}/mention`,
// //         {
// //           method: 'POST',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //           body: JSON.stringify({
// //             mentionedUserId: Number(member.userId),
// //           }),
// //         }
// //       );

// //       if (response.status === 401) {
// //         await goToLogin();

// //         return {
// //           success: false,
// //           message: 'Session expired.',
// //         };
// //       }

// //       const data = await parseResponse(response);

// //       console.log('Mention API Status:', response.status);
// //       console.log('Mention API Response:', data);

// //       if (!response.ok || !data?.success) {
// //         return {
// //           success: false,
// //           message:
// //             data?.message ||
// //             `Failed to mention member. HTTP ${response.status}`,
// //         };
// //       }

// //       return {
// //         success: true,
// //         data: data?.data,
// //         message:
// //           data?.message ||
// //           'Member mentioned successfully.',
// //       };
// //     } catch (error) {
// //       console.log('Mention User Error:', error);

// //       return {
// //         success: false,
// //         message:
// //           error?.message ||
// //           'Unable to mention the selected member.',
// //       };
// //     }
// //   };

// //   const getTaskMentions = async (taskId, token) => {
// //     if (!taskId) {
// //       return [];
// //     }

// //     try {
// //       const response = await fetch(
// //         `${BASE_URL}/Task/${taskId}/mentions`,
// //         {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         }
// //       );

// //       if (response.status === 401) {
// //         await goToLogin();
// //         return [];
// //       }

// //       const data = await parseResponse(response);

// //       console.log('Get Mentions Status:', response.status);
// //       console.log('Get Mentions Response:', data);

// //       if (response.ok && data?.success) {
// //         return Array.isArray(data?.data)
// //           ? data.data
// //           : [];
// //       }

// //       return [];
// //     } catch (error) {
// //       console.log('Get Task Mentions Error:', error);
// //       return [];
// //     }
// //   };

// //   const AddTask = async () => {
// //     if (!title.trim()) {
// //       Alert.alert('Error', 'Please enter task title.');
// //       return;
// //     }

// //     if (!description.trim()) {
// //       Alert.alert('Error', 'Please enter task description.');
// //       return;
// //     }

// //     const token = await AsyncStorage.getItem('token');

// //     if (!token) {
// //       Alert.alert(
// //         'Session Expired',
// //         'Please login again.',
// //         [
// //           {
// //             text: 'OK',
// //             onPress: goToLogin,
// //           },
// //         ]
// //       );
// //       return;
// //     }

// //     try {
// //       setLoading(true);

// //       const formattedDate = formatDueDate(date);
// //       const formattedTime = formatDueTime(date);

// //       const response = await fetch(
// //         `${BASE_URL}/Managment/task`,
// //         {
// //           method: 'POST',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //           body: JSON.stringify({
// //             title: title.trim(),
// //             description: description.trim(),
// //             dueDate: formattedDate,
// //             dueTime: formattedTime,
// //             isTimeBased: true,
// //             groupId: groupIdParam
// //               ? parseInt(groupIdParam, 10)
// //               : null,
// //           }),
// //         }
// //       );

// //       if (response.status === 401) {
// //         await goToLogin();
// //         return;
// //       }

// //       const responseData = await parseResponse(response);

// //       console.log(
// //         'Create Task Response Status:',
// //         response.status
// //       );

// //       console.log(
// //         'Create Task Response Body:',
// //         responseData
// //       );

// //       if (
// //         !response.ok ||
// //         !(
// //           responseData?.success ||
// //           response.status === 200 ||
// //           response.status === 201
// //         )
// //       ) {
// //         Alert.alert(
// //           'Error',
// //           responseData?.message ||
// //             `Failed to create task (HTTP ${response.status}).`
// //         );
// //         return;
// //       }

// //       const createdTaskId =
// //         getTaskIdFromResponse(responseData);

// //       let mentionResult = null;

// //       if (
// //         groupIdParam &&
// //         selectedMentionMember?.userId &&
// //         createdTaskId
// //       ) {
// //         mentionResult = await mentionUser(
// //           createdTaskId,
// //           selectedMentionMember,
// //           token
// //         );

// //         if (mentionResult.success) {
// //           const verifiedMentions =
// //             await getTaskMentions(
// //               createdTaskId,
// //               token
// //             );

// //           console.log(
// //             'Verified task mentions:',
// //             verifiedMentions
// //           );
// //         }
// //       }

// //       if (
// //         selectedMentionMember &&
// //         !createdTaskId
// //       ) {
// //         Alert.alert(
// //           'Task Created',
// //           'The task was created, but the task ID was not returned by the server, so the member could not be mentioned.'
// //         );

// //         navigation.goBack();
// //         return;
// //       }

// //       if (
// //         selectedMentionMember &&
// //         createdTaskId &&
// //         mentionResult &&
// //         !mentionResult.success
// //       ) {
// //         Alert.alert(
// //           'Task Created',
// //           `Task was created successfully, but ${selectedMentionMember.displayName} could not be mentioned.\n\n${mentionResult.message}`,
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => navigation.goBack(),
// //             },
// //           ]
// //         );

// //         return;
// //       }

// //       let successMessage =
// //         responseData?.message ||
// //         'Task created successfully.';

// //       if (
// //         mentionResult?.success &&
// //         selectedMentionMember
// //       ) {
// //         successMessage += `\n\n${selectedMentionMember.displayName} was mentioned successfully.`;
// //       }

// //       Alert.alert(
// //         'Success',
// //         successMessage,
// //         [
// //           {
// //             text: 'OK',
// //             onPress: () => navigation.goBack(),
// //           },
// //         ]
// //       );

// //       setTitle('');
// //       setDescription('');
// //       setDate(new Date());
// //       setSelectedMentionMember(null);
// //     } catch (error) {
// //       console.log('Add Task Error:', error);

// //       Alert.alert(
// //         'Error',
// //         error?.message ||
// //           'Server not reachable.'
// //       );
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleNonTimeBased = () => {
// //     setTaskType('non');

// //     navigation.navigate(
// //       'AddTaskNonTimeBased',
// //       {
// //         groupId: groupIdParam,
// //       }
// //     );
// //   };

// //   const renderMentionModal = () => {
// //     return (
// //       <Modal
// //         visible={showMentionModal}
// //         transparent
// //         animationType="slide"
// //         onRequestClose={() =>
// //           setShowMentionModal(false)
// //         }
// //       >
// //         <View style={styles.modalOverlay}>
// //           <View
// //             style={[
// //               styles.modalContainer,
// //               {
// //                 backgroundColor: cardBg,
// //               },
// //             ]}
// //           >
// //             <View style={styles.modalHeader}>
// //               <View style={styles.modalTitleContainer}>
// //                 <Icon
// //                   name="at-outline"
// //                   size={22}
// //                   color={primaryColor}
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.modalTitle,
// //                     { color: textColor },
// //                   ]}
// //                 >
// //                   Mention Group Member
// //                 </Text>
// //               </View>

// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setShowMentionModal(false)
// //                 }
// //                 style={[
// //                   styles.modalCloseButton,
// //                   { backgroundColor: inputBg },
// //                 ]}
// //               >
// //                 <Icon
// //                   name="close"
// //                   size={20}
// //                   color={textColor}
// //                 />
// //               </TouchableOpacity>
// //             </View>

// //             <Text
// //               style={[
// //                 styles.modalSubtitle,
// //                 { color: subTextColor },
// //               ]}
// //             >
// //               Select a registered group member to
// //               mention in this task.
// //             </Text>

// //             {membersLoading ? (
// //               <View style={styles.emptyContainer}>
// //                 <ActivityIndicator
// //                   size="small"
// //                   color={primaryColor}
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.emptyText,
// //                     { color: subTextColor },
// //                   ]}
// //                 >
// //                   Loading group members...
// //                 </Text>
// //               </View>
// //             ) : groupMembers.length === 0 ? (
// //               <View style={styles.emptyContainer}>
// //                 <Icon
// //                   name="people-outline"
// //                   size={40}
// //                   color={subTextColor}
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.emptyTitle,
// //                     { color: textColor },
// //                   ]}
// //                 >
// //                   No registered members
// //                 </Text>

// //                 <Text
// //                   style={[
// //                     styles.emptyText,
// //                     { color: subTextColor },
// //                   ]}
// //                 >
// //                   There are no registered group members
// //                   available to mention.
// //                 </Text>
// //               </View>
// //             ) : (
// //               <ScrollView
// //                 style={styles.memberList}
// //                 showsVerticalScrollIndicator={false}
// //               >
// //                 {groupMembers.map((member, index) => {
// //                   const isSelected =
// //                     selectedMentionMember?.userId ===
// //                     member.userId;

// //                   return (
// //                     <TouchableOpacity
// //                       key={`${member.userId}-${index}`}
// //                       style={[
// //                         styles.memberItem,
// //                         {
// //                           backgroundColor: isSelected
// //                             ? `${primaryColor}15`
// //                             : inputBg,
// //                           borderColor: isSelected
// //                             ? primaryColor
// //                             : borderClr,
// //                         },
// //                       ]}
// //                       onPress={() => {
// //                         setSelectedMentionMember(
// //                           member
// //                         );
// //                         setShowMentionModal(false);
// //                       }}
// //                       activeOpacity={0.7}
// //                     >
// //                       <View
// //                         style={[
// //                           styles.memberAvatar,
// //                           {
// //                             backgroundColor:
// //                               isSelected
// //                                 ? primaryColor
// //                                 : `${primaryColor}20`,
// //                           },
// //                         ]}
// //                       >
// //                         <Text
// //                           style={[
// //                             styles.memberAvatarText,
// //                             {
// //                               color: isSelected
// //                                 ? '#FFFFFF'
// //                                 : primaryColor,
// //                             },
// //                           ]}
// //                         >
// //                           {(
// //                             member.displayName?.charAt(
// //                               0
// //                             ) || 'M'
// //                           ).toUpperCase()}
// //                         </Text>
// //                       </View>

// //                       <View
// //                         style={
// //                           styles.memberInfo
// //                         }
// //                       >
// //                         <Text
// //                           style={[
// //                             styles.memberName,
// //                             { color: textColor },
// //                           ]}
// //                           numberOfLines={1}
// //                         >
// //                           {member.displayName}
// //                         </Text>

// //                         {!!member.phone && (
// //                           <Text
// //                             style={[
// //                               styles.memberPhone,
// //                               {
// //                                 color: subTextColor,
// //                               },
// //                             ]}
// //                             numberOfLines={1}
// //                           >
// //                             {member.phone}
// //                           </Text>
// //                         )}
// //                       </View>

// //                       {isSelected && (
// //                         <Icon
// //                           name="checkmark-circle"
// //                           size={24}
// //                           color={primaryColor}
// //                         />
// //                       )}
// //                     </TouchableOpacity>
// //                   );
// //                 })}
// //               </ScrollView>
// //             )}

// //             <TouchableOpacity
// //               style={[
// //                 styles.modalCancelButton,
// //                 {
// //                   borderColor: borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 setShowMentionModal(false)
// //               }
// //               activeOpacity={0.7}
// //             >
// //               <Text
// //                 style={[
// //                   styles.modalCancelText,
// //                   { color: textColor },
// //                 ]}
// //               >
// //                 CANCEL
// //               </Text>
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       </Modal>
// //     );
// //   };

// //   return (
// //     <SafeAreaView
// //       style={[
// //         styles.container,
// //         {
// //           backgroundColor:
// //             theme.bg || '#F8FAFC',
// //         },
// //       ]}
// //     >
// //       <StatusBar
// //         barStyle={
// //           isDark
// //             ? 'light-content'
// //             : 'dark-content'
// //         }
// //         backgroundColor={
// //           theme.bg || '#F8FAFC'
// //         }
// //         translucent={
// //           Platform.OS === 'android'
// //         }
// //       />

// //       <View
// //         style={[
// //           styles.header,
// //           {
// //             backgroundColor:
// //               theme.bg || '#F8FAFC',
// //             borderBottomColor: borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           onPress={() => navigation.goBack()}
// //           style={[
// //             styles.backBtn,
// //             { backgroundColor: inputBg },
// //           ]}
// //           activeOpacity={0.7}
// //           accessibilityRole="button"
// //           accessibilityLabel="Go back"
// //         >
// //           <Icon
// //             name="arrow-back"
// //             size={20}
// //             color={textColor}
// //           />
// //         </TouchableOpacity>

// //         <View
// //           style={[
// //             styles.headerBox,
// //             {
// //               backgroundColor:
// //                 theme.headerBox ||
// //                 inputBg,
// //             },
// //           ]}
// //         >
// //           <Text
// //             style={[
// //               styles.headerText,
// //               { color: textColor },
// //             ]}
// //           >
// //             New Task
// //           </Text>
// //         </View>

// //         <View style={styles.headerSpacer} />
// //       </View>

// //       <ScrollView
// //         contentContainerStyle={
// //           styles.content
// //         }
// //         showsVerticalScrollIndicator={false}
// //         keyboardShouldPersistTaps="handled"
// //       >
// //         <View style={styles.responsiveWrapper}>
// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Task Title
// //             </Text>

// //             <TextInput
// //               placeholder="e.g. System Architecture Design"
// //               placeholderTextColor={
// //                 subTextColor
// //               }
// //               style={[
// //                 styles.input,
// //                 {
// //                   color: textColor,
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor: borderClr,
// //                 },
// //               ]}
// //               value={title}
// //               onChangeText={setTitle}
// //               maxLength={200}
// //             />
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Description
// //             </Text>

// //             <TextInput
// //               placeholder="Provide detailed instructions or goals..."
// //               placeholderTextColor={
// //                 subTextColor
// //               }
// //               multiline
// //               numberOfLines={4}
// //               textAlignVertical="top"
// //               style={[
// //                 styles.input,
// //                 styles.descriptionInput,
// //                 {
// //                   color: textColor,
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor: borderClr,
// //                 },
// //               ]}
// //               value={description}
// //               onChangeText={setDescription}
// //             />
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Task Mode
// //             </Text>

// //             <View style={styles.radioRow}>
// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setTaskType('time')
// //                 }
// //                 style={[
// //                   styles.radioItem,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       taskType === 'time'
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={[
// //                     styles.radioOuter,
// //                     {
// //                       borderColor:
// //                         taskType === 'time'
// //                           ? primaryColor
// //                           : subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   {taskType === 'time' && (
// //                     <View
// //                       style={[
// //                         styles.radioInner,
// //                         {
// //                           backgroundColor:
// //                             primaryColor,
// //                         },
// //                       ]}
// //                     />
// //                   )}
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.radioText,
// //                     {
// //                       color: textColor,
// //                       fontWeight:
// //                         taskType === 'time'
// //                           ? '700'
// //                           : '500',
// //                     },
// //                   ]}
// //                 >
// //                   Time Based
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={
// //                   handleNonTimeBased
// //                 }
// //                 style={[
// //                   styles.radioItem,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       taskType === 'non'
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={[
// //                     styles.radioOuter,
// //                     {
// //                       borderColor:
// //                         taskType === 'non'
// //                           ? primaryColor
// //                           : subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   {taskType === 'non' && (
// //                     <View
// //                       style={[
// //                         styles.radioInner,
// //                         {
// //                           backgroundColor:
// //                             primaryColor,
// //                         },
// //                       ]}
// //                     />
// //                   )}
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.radioText,
// //                     {
// //                       color: textColor,
// //                       fontWeight:
// //                         taskType === 'non'
// //                           ? '700'
// //                           : '500',
// //                     },
// //                   ]}
// //                 >
// //                   Non-Time Based
// //                 </Text>
// //               </TouchableOpacity>
// //             </View>
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Date & Time Settings
// //             </Text>

// //             <View style={styles.calendarBox}>
// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setShowDate(true)
// //                 }
// //                 style={[
// //                   styles.dateRow,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={
// //                     styles.dateTimeInfo
// //                   }
// //                 >
// //                   <Icon
// //                     name="calendar-outline"
// //                     size={18}
// //                     color={primaryColor}
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.dateText,
// //                       {
// //                         color: textColor,
// //                       },
// //                     ]}
// //                   >
// //                     {date.toLocaleDateString()}
// //                   </Text>
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.changeText,
// //                     {
// //                       color: primaryColor,
// //                     },
// //                   ]}
// //                 >
// //                   Change Date
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setShowTime(true)
// //                 }
// //                 style={[
// //                   styles.dateRow,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={
// //                     styles.dateTimeInfo
// //                   }
// //                 >
// //                   <Icon
// //                     name="time-outline"
// //                     size={18}
// //                     color={primaryColor}
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.dateText,
// //                       {
// //                         color: textColor,
// //                       },
// //                     ]}
// //                   >
// //                     {date.toLocaleTimeString(
// //                       [],
// //                       {
// //                         hour: '2-digit',
// //                         minute: '2-digit',
// //                       }
// //                     )}
// //                   </Text>
// //                 </View>

// //                 <Text
// //                   style={[
// //                     styles.changeText,
// //                     {
// //                       color: primaryColor,
// //                     },
// //                   ]}
// //                 >
// //                   Change Time
// //                 </Text>
// //               </TouchableOpacity>

// //               {showDate && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="date"
// //                   display={
// //                     Platform.OS === 'ios'
// //                       ? 'spinner'
// //                       : 'calendar'
// //                   }
// //                   onChange={
// //                     onChangeDate
// //                   }
// //                 />
// //               )}

// //               {showTime && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="time"
// //                   display={
// //                     Platform.OS === 'ios'
// //                       ? 'spinner'
// //                       : 'clock'
// //                   }
// //                   onChange={
// //                     onChangeTime
// //                   }
// //                 />
// //               )}
// //             </View>
// //           </View>

// //           {groupIdParam && (
// //             <View
// //               style={[
// //                 styles.card,
// //                 {
// //                   backgroundColor:
// //                     cardBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //             >
// //               <View
// //                 style={
// //                   styles.mentionHeader
// //                 }
// //               >
// //                 <View
// //                   style={
// //                     styles.mentionLabelContainer
// //                   }
// //                 >
// //                   <Icon
// //                     name="at-outline"
// //                     size={18}
// //                     color={primaryColor}
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.label,
// //                       styles.mentionLabel,
// //                       {
// //                         color:
// //                           primaryColor,
// //                       },
// //                     ]}
// //                   >
// //                     Mention Group Member
// //                   </Text>
// //                 </View>
// //               </View>

// //               <TouchableOpacity
// //                 style={[
// //                   styles.dropdown,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       selectedMentionMember
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 onPress={() =>
// //                   setShowMentionModal(true)
// //                 }
// //                 activeOpacity={0.7}
// //               >
// //                 <View
// //                   style={
// //                     styles.selectedMention
// //                   }
// //                 >
// //                   <View
// //                     style={[
// //                       styles.smallAvatar,
// //                       {
// //                         backgroundColor:
// //                           selectedMentionMember
// //                             ? primaryColor
// //                             : `${primaryColor}20`,
// //                       },
// //                     ]}
// //                   >
// //                     <Text
// //                       style={[
// //                         styles.smallAvatarText,
// //                         {
// //                           color:
// //                             selectedMentionMember
// //                               ? '#FFFFFF'
// //                               : primaryColor,
// //                         },
// //                       ]}
// //                     >
// //                       {selectedMentionMember
// //                         ? (
// //                             selectedMentionMember.displayName?.charAt(
// //                               0
// //                             ) || 'M'
// //                           ).toUpperCase()
// //                         : '@'}
// //                     </Text>
// //                   </View>

// //                   <View
// //                     style={
// //                       styles.selectedMentionInfo
// //                     }
// //                   >
// //                     <Text
// //                       style={[
// //                         styles.dropdownText,
// //                         {
// //                           color:
// //                             textColor,
// //                         },
// //                       ]}
// //                       numberOfLines={1}
// //                     >
// //                       {selectedMentionMember
// //                         ? selectedMentionMember.displayName
// //                         : 'Select a group member'}
// //                     </Text>

// //                     {selectedMentionMember && (
// //                       <Text
// //                         style={[
// //                           styles.mentionSubText,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         Will be mentioned after task creation
// //                       </Text>
// //                     )}
// //                   </View>
// //                 </View>

// //                 <Icon
// //                   name="chevron-down"
// //                   size={18}
// //                   color={subTextColor}
// //                 />
// //               </TouchableOpacity>

// //               {selectedMentionMember && (
// //                 <TouchableOpacity
// //                   style={
// //                     styles.removeMentionButton
// //                   }
// //                   onPress={() =>
// //                     setSelectedMentionMember(
// //                       null
// //                     )
// //                   }
// //                   activeOpacity={0.7}
// //                 >
// //                   <Icon
// //                     name="close-circle-outline"
// //                     size={16}
// //                     color="#EF4444"
// //                   />

// //                   <Text
// //                     style={
// //                       styles.removeMentionText
// //                     }
// //                   >
// //                     Remove mention
// //                   </Text>
// //                 </TouchableOpacity>
// //               )}

// //               <Text
// //                 style={[
// //                   styles.helperText,
// //                   {
// //                     color:
// //                       subTextColor,
// //                   },
// //                 ]}
// //               >
// //                 The selected member will receive a
// //                 notification when the task is created.
// //               </Text>
// //             </View>
// //           )}

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor: cardBg,
// //                 borderColor: borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 { color: primaryColor },
// //               ]}
// //             >
// //               Assign Task To
// //             </Text>

// //             <TouchableOpacity
// //               style={[
// //                 styles.dropdown,
// //                 {
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 navigation.navigate(
// //                   'ForwardTaskTo'
// //                 )
// //               }
// //               activeOpacity={0.7}
// //             >
// //               <Text
// //                 style={[
// //                   styles.dropdownText,
// //                   {
// //                     color: textColor,
// //                   },
// //                 ]}
// //               >
// //                 Select Recipient / Group
// //               </Text>

// //               <Icon
// //                 name="chevron-down"
// //                 size={18}
// //                 color={subTextColor}
// //               />
// //             </TouchableOpacity>
// //           </View>

// //           <View style={styles.btnRow}>
// //             <TouchableOpacity
// //               style={[
// //                 styles.btn,
// //                 styles.cancelBtn,
// //                 {
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 navigation.goBack()
// //               }
// //               disabled={loading}
// //               activeOpacity={0.7}
// //             >
// //               <Text
// //                 style={[
// //                   styles.btnText,
// //                   { color: textColor },
// //                 ]}
// //               >
// //                 CANCEL
// //               </Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={[
// //                 styles.btn,
// //                 styles.submitBtn,
// //                 {
// //                   backgroundColor:
// //                     primaryColor,
// //                 },
// //                 loading &&
// //                   styles.btnDisabled,
// //               ]}
// //               onPress={AddTask}
// //               disabled={loading}
// //               activeOpacity={0.8}
// //             >
// //               {loading ? (
// //                 <ActivityIndicator
// //                   color="#FFFFFF"
// //                   size="small"
// //                 />
// //               ) : (
// //                 <Text
// //                   style={
// //                     styles.submitBtnText
// //                   }
// //                 >
// //                   ADD TASK
// //                 </Text>
// //               )}
// //             </TouchableOpacity>
// //           </View>
// //         </View>
// //       </ScrollView>

// //       <View
// //         style={[
// //           styles.bottom,
// //           {
// //             backgroundColor:
// //               theme.bottomNav ||
// //               (isDark
// //                 ? '#1E293B'
// //                 : '#0F172A'),
// //             borderTopColor:
// //               borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'HomeDashboard'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="home-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             Home
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               'AddMember'
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="person-add-outline"
// //             size={22}
// //             color="#94A3B8"
// //           />

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             Members
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
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

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             History
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
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

// //           <Text
// //             style={styles.bottomNavText}
// //           >
// //             Settings
// //           </Text>
// //         </TouchableOpacity>
// //       </View>

// //       {renderMentionModal()}
// //     </SafeAreaView>
// //   );
// // };

// // export default AddTaskTimeBased;

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //   },

// //   header: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingTop:
// //       Platform.OS === 'android'
// //         ? (StatusBar.currentHeight || 24) + 8
// //         : 12,
// //     paddingBottom: 12,
// //     borderBottomWidth: 1,
// //     zIndex: 10,
// //   },

// //   backBtn: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   headerBox: {
// //     paddingHorizontal: 20,
// //     paddingVertical: 6,
// //     borderRadius: 20,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   headerText: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     letterSpacing: 0.3,
// //   },

// //   headerSpacer: {
// //     width: 40,
// //   },

// //   content: {
// //     paddingHorizontal: 16,
// //     paddingTop: 16,
// //     paddingBottom: 110,
// //   },

// //   responsiveWrapper: {
// //     width: '100%',
// //     maxWidth: 600,
// //     alignSelf: 'center',
// //   },

// //   card: {
// //     borderRadius: 16,
// //     padding: 16,
// //     marginBottom: 16,
// //     borderWidth: 1,
// //     elevation: 1,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: 1,
// //     },
// //     shadowOpacity: 0.04,
// //     shadowRadius: 3,
// //   },

// //   label: {
// //     fontSize: 12,
// //     fontWeight: '700',
// //     textTransform: 'uppercase',
// //     letterSpacing: 0.8,
// //     marginBottom: 10,
// //   },

// //   input: {
// //     fontSize: 15,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },

// //   descriptionInput: {
// //     minHeight: 110,
// //   },

// //   radioRow: {
// //     flexDirection:
// //       width < 360
// //         ? 'column'
// //         : 'row',
// //     gap: 12,
// //   },

// //   radioItem: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     paddingVertical: 12,
// //     paddingHorizontal: 14,
// //     borderRadius: 12,
// //     borderWidth: 1.5,
// //     minHeight: 50,
// //   },

// //   radioOuter: {
// //     width: 20,
// //     height: 20,
// //     borderRadius: 10,
// //     borderWidth: 2,
// //     marginRight: 10,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   radioInner: {
// //     width: 10,
// //     height: 10,
// //     borderRadius: 5,
// //   },

// //   radioText: {
// //     fontSize: 14,
// //   },

// //   calendarBox: {
// //     gap: 10,
// //   },

// //   dateRow: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },

// //   dateTimeInfo: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 10,
// //   },

// //   dateText: {
// //     fontSize: 14,
// //     fontWeight: '600',
// //   },

// //   changeText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //   },

// //   dropdown: {
// //     borderRadius: 12,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderWidth: 1,
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     minHeight: 50,
// //   },

// //   dropdownText: {
// //     fontSize: 14,
// //     fontWeight: '500',
// //   },

// //   mentionHeader: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //   },

// //   mentionLabelContainer: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //   },

// //   mentionLabel: {
// //     marginBottom: 10,
// //     marginLeft: 7,
// //   },

// //   selectedMention: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     minWidth: 0,
// //   },

// //   smallAvatar: {
// //     width: 34,
// //     height: 34,
// //     borderRadius: 17,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     marginRight: 10,
// //   },

// //   smallAvatarText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //   },

// //   selectedMentionInfo: {
// //     flex: 1,
// //     minWidth: 0,
// //   },

// //   mentionSubText: {
// //     fontSize: 11,
// //     marginTop: 2,
// //   },

// //   removeMentionButton: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     alignSelf: 'flex-start',
// //     marginTop: 10,
// //     paddingVertical: 4,
// //   },

// //   removeMentionText: {
// //     color: '#EF4444',
// //     fontSize: 12,
// //     fontWeight: '600',
// //     marginLeft: 5,
// //   },

// //   helperText: {
// //     fontSize: 11,
// //     lineHeight: 16,
// //     marginTop: 10,
// //   },

// //   btnRow: {
// //     flexDirection: 'row',
// //     gap: 12,
// //     marginTop: 8,
// //   },

// //   btn: {
// //     flex: 1,
// //     paddingVertical: 14,
// //     borderRadius: 12,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     minHeight: 52,
// //   },

// //   cancelBtn: {
// //     backgroundColor: 'transparent',
// //     borderWidth: 1,
// //   },

// //   submitBtn: {
// //     elevation: 3,
// //     shadowColor: '#2563EB',
// //     shadowOffset: {
// //       width: 0,
// //       height: 3,
// //     },
// //     shadowOpacity: 0.3,
// //     shadowRadius: 5,
// //   },

// //   btnDisabled: {
// //     opacity: 0.6,
// //   },

// //   btnText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },

// //   submitBtnText: {
// //     color: '#FFFFFF',
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },

// //   bottom: {
// //     position: 'absolute',
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     height: 65,
// //     flexDirection: 'row',
// //     justifyContent: 'space-around',
// //     alignItems: 'center',
// //     borderTopWidth: 1,
// //     elevation: 10,
// //     shadowColor: '#000',
// //     shadowOffset: {
// //       width: 0,
// //       height: -3,
// //     },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 4,
// //   },

// //   iconBtn: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 6,
// //     minHeight: 48,
// //   },

// //   bottomNavText: {
// //     color: '#94A3B8',
// //     fontSize: 10,
// //     fontWeight: '600',
// //     marginTop: 3,
// //   },

// //   modalOverlay: {
// //     flex: 1,
// //     backgroundColor: 'rgba(0, 0, 0, 0.55)',
// //     justifyContent: 'flex-end',
// //   },

// //   modalContainer: {
// //     width: '100%',
// //     maxHeight: '80%',
// //     borderTopLeftRadius: 24,
// //     borderTopRightRadius: 24,
// //     padding: 20,
// //   },

// //   modalHeader: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     marginBottom: 8,
// //   },

// //   modalTitleContainer: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     flex: 1,
// //   },

// //   modalTitle: {
// //     fontSize: 18,
// //     fontWeight: '700',
// //     marginLeft: 8,
// //   },

// //   modalCloseButton: {
// //     width: 36,
// //     height: 36,
// //     borderRadius: 18,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },

// //   modalSubtitle: {
// //     fontSize: 13,
// //     lineHeight: 19,
// //     marginBottom: 16,
// //   },

// //   memberList: {
// //     maxHeight: 420,
// //   },

// //   memberItem: {
// //     minHeight: 68,
// //     borderRadius: 14,
// //     borderWidth: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     paddingHorizontal: 12,
// //     marginBottom: 10,
// //   },

// //   memberAvatar: {
// //     width: 42,
// //     height: 42,
// //     borderRadius: 21,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     marginRight: 12,
// //   },

// //   memberAvatarText: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //   },

// //   memberInfo: {
// //     flex: 1,
// //     minWidth: 0,
// //   },

// //   memberName: {
// //     fontSize: 15,
// //     fontWeight: '700',
// //   },

// //   memberPhone: {
// //     fontSize: 12,
// //     marginTop: 3,
// //   },

// //   emptyContainer: {
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 40,
// //   },

// //   emptyTitle: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     marginTop: 10,
// //   },

// //   emptyText: {
// //     fontSize: 13,
// //     textAlign: 'center',
// //     marginTop: 6,
// //     lineHeight: 19,
// //   },

// //   modalCancelButton: {
// //     minHeight: 48,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     marginTop: 14,
// //   },

// //   modalCancelText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },
// // });







































// // import React, { useState } from 'react';
// // import {
// //   SafeAreaView,
// //   View,
// //   Text,
// //   StyleSheet,
// //   TouchableOpacity,
// //   TextInput,
// //   ScrollView,
// //   Alert,
// //   Platform,
// //   ActivityIndicator,
// //   StatusBar,
// //   Dimensions,
// // } from 'react-native';
// // import AsyncStorage from '@react-native-async-storage/async-storage';
// // import Icon from '@react-native-vector-icons/ionicons';
// // import DateTimePicker from '@react-native-community/datetimepicker';
// // import { useTheme } from '../../context/ThemeContext';
// // import { BASE_URL } from "../../config/api";

// // const { width } = Dimensions.get('window');

// // const AddTaskTimeBased = ({ navigation, route }) => {
// //   const { isDark, theme } = useTheme();

// //   const [taskType, setTaskType] = useState('time');
// //   const [title, setTitle] = useState('');
// //   const [description, setDescription] = useState('');

// //   const [date, setDate] = useState(new Date());
// //   const [showDate, setShowDate] = useState(false);
// //   const [showTime, setShowTime] = useState(false);

// //   const [loading, setLoading] = useState(false);

// //   const [groups, setGroups] = useState([]);
// //   const [selectedGroup, setSelectedGroup] = useState(null);

// //   const groupIdParam = route?.params?.groupId || null;

// //   React.useEffect(() => {
// //     const fetchGroups = async () => {
// //       try {
// //         const token = await AsyncStorage.getItem('token');
// //         const response = await fetch(`${BASE_URL}/Management/groups`, {
// //           method: 'GET',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //         });

// //         // Safe JSON Parsing
// //         const text = await response.text();
// //         const data = text ? JSON.parse(text) : {};

// //         if (response.ok && data?.success) {
// //           setGroups(data.data || []);
// //         }
// //       } catch (err) {
// //         console.log('Error fetching groups:', err);
// //       }
// //     };
// //     fetchGroups();
// //   }, []);

// //   // ✅ DATE HANDLER
// //   const onChangeDate = (event, selectedDate) => {
// //     if (Platform.OS === 'android') setShowDate(false);

// //     if (selectedDate) {
// //       const newDate = new Date(date);
// //       newDate.setFullYear(selectedDate.getFullYear());
// //       newDate.setMonth(selectedDate.getMonth());
// //       newDate.setDate(selectedDate.getDate());
// //       setDate(newDate);
// //     }
// //   };

// //   // ✅ TIME HANDLER
// //   const onChangeTime = (event, selectedTime) => {
// //     if (Platform.OS === 'android') setShowTime(false);

// //     if (selectedTime) {
// //       const newDate = new Date(date);
// //       newDate.setHours(selectedTime.getHours());
// //       newDate.setMinutes(selectedTime.getMinutes());
// //       setDate(newDate);
// //     }
// //   };

// //   // ✅ SAFE DATE & TIME FORMATTERS FOR ASP.NET (DateOnly & TimeOnly)
// //   const formatDueDate = (d) => {
// //     const year = d.getFullYear();
// //     const month = String(d.getMonth() + 1).padStart(2, '0');
// //     const day = String(d.getDate()).padStart(2, '0');
// //     return `${year}-${month}-${day}`;
// //   };

// //   const formatDueTime = (d) => {
// //     const hours = String(d.getHours()).padStart(2, '0');
// //     const minutes = String(d.getMinutes()).padStart(2, '0');
// //     const seconds = String(d.getSeconds()).padStart(2, '0');
// //     return `${hours}:${minutes}:${seconds}`;
// //   };

// //   // ✅ API FUNCTION
// //   const AddTask = async () => {
// //     if (!title.trim() || !description.trim()) {
// //       Alert.alert('Error', 'Please fill all fields');
// //       return;
// //     }

// //     const token = await AsyncStorage.getItem('token');

// //     if (!token) {
// //       Alert.alert(
// //         'Session Expired',
// //         'Please login again.',
// //         [
// //           {
// //             text: 'OK',
// //             onPress: () => navigation.replace('Login'),
// //           },
// //         ]
// //       );
// //       return;
// //     }

// //     try {
// //       setLoading(true);

// //       const formattedDate = formatDueDate(date); // YYYY-MM-DD
// //       const formattedTime = formatDueTime(date); // HH:mm:ss

// //       const response = await fetch(`${BASE_URL}/Managment/task`, {
// //         method: 'POST',
// //         headers: {
// //           'Content-Type': 'application/json',
// //           Authorization: `Bearer ${token}`,
// //         },
// //         body: JSON.stringify({
// //           title: title.trim(),
// //           description: description.trim(),
// //           dueDate: formattedDate,
// //           dueTime: formattedTime,
// //           isTimeBased: true,
// //           groupId: groupIdParam ? parseInt(groupIdParam, 10) : null,
// //         }),
// //       });

// //       // Safely handle empty response body
// //       const responseText = await response.text();
// //       let responseData = {};
      
// //       try {
// //         responseData = responseText ? JSON.parse(responseText) : {};
// //       } catch (e) {
// //         console.log('Failed to parse response JSON:', responseText);
// //       }

// //       console.log('Create Task Response Status:', response.status);
// //       console.log('Create Task Response Body:', responseData);

// //       if (response.ok && (responseData?.success || response.status === 200 || response.status === 201)) {
// //         Alert.alert(
// //           'Success',
// //           responseData?.message || 'Task created successfully.',
// //           [
// //             {
// //               text: 'OK',
// //               onPress: () => navigation.goBack(),
// //             },
// //           ]
// //         );

// //         setTitle('');
// //         setDescription('');
// //         setDate(new Date());
// //       } else {
// //         Alert.alert(
// //           'Error',
// //           responseData?.message || `Failed to create task (HTTP ${response.status}).`
// //         );
// //       }

// //     } catch (error) {
// //       console.log('Add Task Error:', error);

// //       Alert.alert(
// //         'Error',
// //         error.message || 'Server not reachable.'
// //       );

// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleNonTimeBased = () => {
// //     setTaskType('non');
// //     navigation.navigate('AddTaskNonTimeBased', { groupId: groupIdParam });
// //   };

// //   const primaryColor = theme.primary || '#2563EB';
// //   const cardBg = theme.card || '#FFFFFF';
// //   const textColor = theme.text || '#0F172A';
// //   const subTextColor = theme.subText || '#64748B';
// //   const borderClr = theme.border || '#E2E8F0';
// //   const inputBg = theme.inputBg || (isDark ? '#1E293B' : '#F8FAFC');

// //   return (
// //     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg || '#F8FAFC' }]}>
// //       <StatusBar
// //         barStyle={isDark ? 'light-content' : 'dark-content'}
// //         backgroundColor={theme.bg || '#F8FAFC'}
// //         translucent={Platform.OS === 'android'}
// //       />

// //       {/* HEADER */}
// //       <View style={[styles.header, { backgroundColor: theme.bg || '#F8FAFC', borderBottomColor: borderClr }]}>
// //         <TouchableOpacity 
// //           onPress={() => navigation.goBack()}
// //           style={[styles.backBtn, { backgroundColor: inputBg }]}
// //           activeOpacity={0.7}
// //           accessibilityRole="button"
// //           accessibilityLabel="Go back"
// //         >
// //           <Icon name="arrow-back" size={20} color={textColor} />
// //         </TouchableOpacity>

// //         <View style={[styles.headerBox, { backgroundColor: theme.headerBox || inputBg }]}>
// //           <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
// //         </View>

// //         <View style={styles.headerSpacer} />
// //       </View>

// //       <ScrollView 
// //         contentContainerStyle={styles.content}
// //         showsVerticalScrollIndicator={false}
// //         keyboardShouldPersistTaps="handled"
// //       >
// //         <View style={styles.responsiveWrapper}>
          
// //           {/* TITLE INPUT CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Task Title</Text>
// //             <TextInput
// //               placeholder="e.g. System Architecture Design"
// //               placeholderTextColor={subTextColor}
// //               style={[styles.input, { color: textColor, backgroundColor: inputBg, borderColor: borderClr }]}
// //               value={title}
// //               onChangeText={setTitle}
// //             />
// //           </View>

// //           {/* DESCRIPTION INPUT CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Description</Text>
// //             <TextInput
// //               placeholder="Provide detailed instructions or goals..."
// //               placeholderTextColor={subTextColor}
// //               multiline
// //               numberOfLines={4}
// //               textAlignVertical="top"
// //               style={[
// //                 styles.input,
// //                 styles.descriptionInput,
// //                 { color: textColor, backgroundColor: inputBg, borderColor: borderClr },
// //               ]}
// //               value={description}
// //               onChangeText={setDescription}
// //             />
// //           </View>

// //           {/* TASK MODE SELECTOR CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Task Mode</Text>
// //             <View style={styles.radioRow}>
// //               <TouchableOpacity
// //                 onPress={() => setTaskType('time')}
// //                 style={[
// //                   styles.radioItem,
// //                   { backgroundColor: inputBg, borderColor: taskType === 'time' ? primaryColor : borderClr },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={[styles.radioOuter, { borderColor: taskType === 'time' ? primaryColor : subTextColor }]}>
// //                   {taskType === 'time' && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
// //                 </View>
// //                 <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === 'time' ? '700' : '500' }]}>
// //                   Time Based
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={handleNonTimeBased}
// //                 style={[
// //                   styles.radioItem,
// //                   { backgroundColor: inputBg, borderColor: taskType === 'non' ? primaryColor : borderClr },
// //                 ]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={[styles.radioOuter, { borderColor: taskType === 'non' ? primaryColor : subTextColor }]}>
// //                   {taskType === 'non' && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
// //                 </View>
// //                 <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === 'non' ? '700' : '500' }]}>
// //                   Non-Time Based
// //                 </Text>
// //               </TouchableOpacity>
// //             </View>
// //           </View>

// //           {/* DATE & TIME CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Date & Time Settings</Text>

// //             <View style={styles.calendarBox}>
// //               <TouchableOpacity
// //                 onPress={() => setShowDate(true)}
// //                 style={[styles.dateRow, { backgroundColor: inputBg, borderColor: borderClr }]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={styles.dateTimeInfo}>
// //                   <Icon name="calendar-outline" size={18} color={primaryColor} />
// //                   <Text style={[styles.dateText, { color: textColor }]}>
// //                     {date.toLocaleDateString()}
// //                   </Text>
// //                 </View>
// //                 <Text style={[styles.changeText, { color: primaryColor }]}>Change Date</Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={() => setShowTime(true)}
// //                 style={[styles.dateRow, { backgroundColor: inputBg, borderColor: borderClr }]}
// //                 activeOpacity={0.7}
// //               >
// //                 <View style={styles.dateTimeInfo}>
// //                   <Icon name="time-outline" size={18} color={primaryColor} />
// //                   <Text style={[styles.dateText, { color: textColor }]}>
// //                     {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
// //                   </Text>
// //                 </View>
// //                 <Text style={[styles.changeText, { color: primaryColor }]}>Change Time</Text>
// //               </TouchableOpacity>

// //               {showDate && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="date"
// //                   display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
// //                   onChange={onChangeDate}
// //                 />
// //               )}

// //               {showTime && (
// //                 <DateTimePicker
// //                   value={date}
// //                   mode="time"
// //                   display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
// //                   onChange={onChangeTime}
// //                 />
// //               )}
// //             </View>
// //           </View>

// //           {/* RECIPIENT DROPDOWN CARD */}
// //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// //             <Text style={[styles.label, { color: primaryColor }]}>Assign Task To</Text>
// //             <TouchableOpacity
// //               style={[styles.dropdown, { backgroundColor: inputBg, borderColor: borderClr }]}
// //               onPress={() => navigation.navigate("ForwardTaskTo")}
// //               activeOpacity={0.7}
// //             >
// //               <Text style={[styles.dropdownText, { color: textColor }]}>Select Recipient / Group</Text>
// //               <Icon name="chevron-down" size={18} color={subTextColor} />
// //             </TouchableOpacity>
// //           </View>

// //           {/* ACTION BUTTONS */}
// //           <View style={styles.btnRow}>
// //             <TouchableOpacity
// //               style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
// //               onPress={() => navigation.goBack()}
// //               disabled={loading}
// //               activeOpacity={0.7}
// //             >
// //               <Text style={[styles.btnText, { color: textColor }]}>CANCEL</Text>
// //             </TouchableOpacity>

// //             <TouchableOpacity
// //               style={[
// //                 styles.btn,
// //                 styles.submitBtn,
// //                 { backgroundColor: primaryColor },
// //                 loading && styles.btnDisabled,
// //               ]}
// //               onPress={AddTask}
// //               disabled={loading}
// //               activeOpacity={0.8}
// //             >
// //               {loading ? (
// //                 <ActivityIndicator color="#FFFFFF" size="small" />
// //               ) : (
// //                 <Text style={styles.submitBtnText}>ADD TASK</Text>
// //               )}
// //             </TouchableOpacity>
// //           </View>

// //         </View>
// //       </ScrollView>

// //       {/* BOTTOM NAV */}
// //       <View
// //         style={[
// //           styles.bottom,
// //           {
// //             backgroundColor: theme.bottomNav || (isDark ? '#1E293B' : '#0F172A'),
// //             borderTopColor: borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('HomeDashboard')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="home-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>Home</Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('AddMember')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="person-add-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>Members</Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="time-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>History</Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() => navigation.navigate('SettingScreen')}
// //           activeOpacity={0.7}
// //         >
// //           <Icon name="settings-outline" size={22} color="#94A3B8" />
// //           <Text style={styles.bottomNavText}>Settings</Text>
// //         </TouchableOpacity>
// //       </View>
// //     </SafeAreaView>
// //   );
// // };

// // export default AddTaskTimeBased;

// // const styles = StyleSheet.create({
// //   container: { flex: 1 },
// //   header: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
// //     paddingBottom: 12,
// //     borderBottomWidth: 1,
// //     zIndex: 10,
// //   },
// //   backBtn: {
// //     width: 40,
// //     height: 40,
// //     borderRadius: 20,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },
// //   headerBox: {
// //     paddingHorizontal: 20,
// //     paddingVertical: 6,
// //     borderRadius: 20,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },
// //   headerText: {
// //     fontSize: 16,
// //     fontWeight: '700',
// //     letterSpacing: 0.3,
// //   },
// //   headerSpacer: { width: 40 },
// //   content: {
// //     paddingHorizontal: 16,
// //     paddingTop: 16,
// //     paddingBottom: 110,
// //   },
// //   responsiveWrapper: {
// //     width: '100%',
// //     maxWidth: 600,
// //     alignSelf: 'center',
// //   },
// //   card: {
// //     borderRadius: 16,
// //     padding: 16,
// //     marginBottom: 16,
// //     borderWidth: 1,
// //     elevation: 1,
// //     shadowColor: '#000',
// //     shadowOffset: { width: 0, height: 1 },
// //     shadowOpacity: 0.04,
// //     shadowRadius: 3,
// //   },
// //   label: {
// //     fontSize: 12,
// //     fontWeight: '700',
// //     textTransform: 'uppercase',
// //     letterSpacing: 0.8,
// //     marginBottom: 10,
// //   },
// //   input: {
// //     fontSize: 15,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },
// //   descriptionInput: { minHeight: 110 },
// //   radioRow: {
// //     flexDirection: width < 360 ? 'column' : 'row',
// //     gap: 12,
// //   },
// //   radioItem: {
// //     flex: 1,
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     paddingVertical: 12,
// //     paddingHorizontal: 14,
// //     borderRadius: 12,
// //     borderWidth: 1.5,
// //     minHeight: 50,
// //   },
// //   radioOuter: {
// //     width: 20,
// //     height: 20,
// //     borderRadius: 10,
// //     borderWidth: 2,
// //     marginRight: 10,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //   },
// //   radioInner: {
// //     width: 10,
// //     height: 10,
// //     borderRadius: 5,
// //   },
// //   radioText: { fontSize: 14 },
// //   calendarBox: { gap: 10 },
// //   dateRow: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'space-between',
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     minHeight: 50,
// //   },
// //   dateTimeInfo: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     gap: 10,
// //   },
// //   dateText: {
// //     fontSize: 14,
// //     fontWeight: '600',
// //   },
// //   changeText: {
// //     fontSize: 13,
// //     fontWeight: '700',
// //   },
// //   dropdown: {
// //     borderRadius: 12,
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderWidth: 1,
// //     flexDirection: 'row',
// //     justifyContent: 'space-between',
// //     alignItems: 'center',
// //     minHeight: 50,
// //   },
// //   dropdownText: {
// //     fontSize: 14,
// //     fontWeight: '500',
// //   },
// //   btnRow: {
// //     flexDirection: 'row',
// //     gap: 12,
// //     marginTop: 8,
// //   },
// //   btn: {
// //     flex: 1,
// //     paddingVertical: 14,
// //     borderRadius: 12,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     minHeight: 52,
// //   },
// //   cancelBtn: {
// //     backgroundColor: 'transparent',
// //     borderWidth: 1,
// //   },
// //   submitBtn: {
// //     elevation: 3,
// //     shadowColor: '#2563EB',
// //     shadowOffset: { width: 0, height: 3 },
// //     shadowOpacity: 0.3,
// //     shadowRadius: 5,
// //   },
// //   btnDisabled: { opacity: 0.6 },
// //   btnText: {
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },
// //   submitBtnText: {
// //     color: '#FFFFFF',
// //     fontSize: 14,
// //     fontWeight: '700',
// //     letterSpacing: 0.5,
// //   },
// //   bottom: {
// //     position: 'absolute',
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     height: 65,
// //     flexDirection: 'row',
// //     justifyContent: 'space-around',
// //     alignItems: 'center',
// //     borderTopWidth: 1,
// //     elevation: 10,
// //     shadowColor: '#000',
// //     shadowOffset: { width: 0, height: -3 },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 4,
// //   },
// //   iconBtn: {
// //     flex: 1,
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     paddingVertical: 6,
// //     minHeight: 48,
// //   },
// //   bottomNavText: {
// //     color: '#94A3B8',
// //     fontSize: 10,
// //     fontWeight: '600',
// //     marginTop: 3,
// //   },
// // });
































// // // import React, { useState } from 'react';
// // // import {
// // //   SafeAreaView,
// // //   View,
// // //   Text,
// // //   StyleSheet,
// // //   TouchableOpacity,
// // //   TextInput,
// // //   ScrollView,
// // //   Alert,
// // //   Platform,
// // //   ActivityIndicator,
// // // } from 'react-native';
// // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // import Icon from 'react-native-vector-icons/Ionicons';
// // // import DateTimePicker from '@react-native-community/datetimepicker';
// // // import { apiClient } from '../../utils/apiClient';
// // // import { useTheme } from '../../context/ThemeContext';


// // // const AddTaskTimeBased = ({ navigation, route }) => {
// // //   const { isDark, theme } = useTheme();

// // //   const [taskType, setTaskType] = useState('time');
// // //   const [title, setTitle] = useState('');
// // //   const [description, setDescription] = useState('');

// // //   const [date, setDate] = useState(new Date());
// // //   const [showDate, setShowDate] = useState(false);
// // //   const [showTime, setShowTime] = useState(false);

// // //   const [loading, setLoading] = useState(false);

// // //   const [groups, setGroups] = useState([]);
// // //   const [selectedGroup, setSelectedGroup] = useState(null);
// // //   const [showGroupDropdown, setShowGroupDropdown] = useState(false);

// // //   const groupIdParam = route?.params?.groupId || null;

// // //   React.useEffect(() => {
// // //     const fetchGroups = async () => {
// // //       try {
// // //         const response = await apiClient('/groups');
// // //         if (response && response.success) setGroups(response.data || []);
// // //       } catch (err) {}
// // //     };
// // //     fetchGroups();
// // //   }, []);

// // //   // ✅ DATE HANDLER
// // //   const onChangeDate = (event, selectedDate) => {
// // //     if (Platform.OS === 'android') setShowDate(false);

// // //     if (selectedDate) {
// // //       const newDate = new Date(date);
// // //       newDate.setFullYear(selectedDate.getFullYear());
// // //       newDate.setMonth(selectedDate.getMonth());
// // //       newDate.setDate(selectedDate.getDate());
// // //       setDate(newDate);
// // //     }
// // //   };

// // //   // ✅ TIME HANDLER
// // //   const onChangeTime = (event, selectedTime) => {
// // //     if (Platform.OS === 'android') setShowTime(false);

// // //     if (selectedTime) {
// // //       const newDate = new Date(date);
// // //       newDate.setHours(selectedTime.getHours());
// // //       newDate.setMinutes(selectedTime.getMinutes());
// // //       setDate(newDate);
// // //     }
// // //   };

// // //   // ✅ API FUNCTION
// // //   const AddTask = async () => {
// // //     // Validation
// // //     if (!title.trim() || !description.trim()) {
// // //       Alert.alert("Error", "Please fill all fields");
// // //       return;
// // //     }

// // //     // Check login
// // //     const token = await AsyncStorage.getItem("token");

// // //     if (!token) {
// // //       Alert.alert(
// // //         "Session Expired",
// // //         "Please login again.",
// // //         [
// // //           {
// // //             text: "OK",
// // //             onPress: () => navigation.replace("Login"),
// // //           },
// // //         ]
// // //       );
// // //       return;
// // //     }

// // //     try {
// // //       setLoading(true);

// // //       const response = await apiClient("/tasks", {
// // //         method: "POST",
// // //         body: JSON.stringify({
// // //           title: title.trim(),
// // //           description: description.trim(),
// // //           dueDate:
// // //             date.getFullYear() +
// // //             "-" +
// // //             String(date.getMonth() + 1).padStart(2, "0") +
// // //             "-" +
// // //             String(date.getDate()).padStart(2, "0"),
// // //           dueTime:
// // //             String(date.getHours()).padStart(2, "0") +
// // //             ":" +
// // //             String(date.getMinutes()).padStart(2, "0"),
// // //           isTimeBased: true,
// // //           groupId: groupIdParam,
// // //         }),
// // //       });

// // //       console.log("Create Task Response:", response);

// // //       if (response?.success) {
// // //         Alert.alert(
// // //           "Success",
// // //           response.message || "Task created successfully.",
// // //           [
// // //             {
// // //               text: "OK",
// // //               onPress: () => navigation.goBack(),
// // //             },
// // //           ]
// // //         );

// // //         setTitle("");
// // //         setDescription("");
// // //         setDate(new Date());

// // //       } else {
// // //         Alert.alert(
// // //           "Error",
// // //           response?.message || "Failed to create task."
// // //         );
// // //       }

// // //     } catch (error) {
// // //       console.log("Add Task Error:", error);

// // //       Alert.alert(
// // //         "Error",
// // //         error.message || "Server not reachable."
// // //       );

// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   const handleNonTimeBased = () => {
// // //     setTaskType('non');
// // //     navigation.navigate('AddTaskNonTimeBased', { groupId: groupIdParam });
// // //   };

// // //   return (
// // //     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
// // //       <ScrollView contentContainerStyle={styles.content}>

// // //         {/* HEADER */}
// // //         <View style={styles.header}>
// // //           <TouchableOpacity onPress={() => navigation.goBack()}>
// // //             <Icon name="arrow-back" size={22} color={theme.text} />
// // //           </TouchableOpacity>

// // //           <View style={[styles.headerBox, { backgroundColor: theme.headerBox }]}>
// // //             <Text style={[styles.headerText, { color: theme.text }]}>ADD-TASK</Text>
// // //           </View>

// // //           <View style={{ width: 22 }} />
// // //         </View>

// // //         {/* TITLE */}
// // //         <View style={[styles.card, { backgroundColor: theme.card }]}>
// // //           <Text style={[styles.label, { color: theme.text }]}>TITLE:</Text>
// // //           <TextInput value={title} onChangeText={setTitle} />
// // //         </View>

// // //         {/* DESCRIPTION */}
// // //         <View style={[styles.card, { height: 120 }, { backgroundColor: theme.card }]}>
// // //           <Text style={[styles.label, { color: theme.text }]}>DESCRIPTION</Text>
// // //           <TextInput
// // //             multiline
// // //             value={description}
// // //             onChangeText={setDescription}
// // //           />
// // //         </View>

// // //         {/* TYPE */}
// // //         <Text style={[styles.section, { color: theme.text }]}>TIME BASED & NON TIME BASED:</Text>

// // //         <View style={styles.radioRow}>
// // //           <TouchableOpacity onPress={() => setTaskType('time')} style={styles.radioItem}>
// // //             <View style={styles.radioOuter}>
// // //               {taskType === 'time' && <View style={styles.radioInner} />}
// // //             </View>
// // //             <Text style={{ color: theme.text }}>TIME BASED</Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity onPress={handleNonTimeBased} style={styles.radioItem}>
// // //             <View style={styles.radioOuter}>
// // //               {taskType === 'non' && <View style={styles.radioInner} />}
// // //             </View>
// // //             <Text style={{ color: theme.text }}>NON-TIME BASED</Text>
// // //           </TouchableOpacity>
// // //         </View>

// // //         {/* DATE & TIME */}
// // //         <Text style={[styles.section, { color: theme.text }]}>DATE & TIME</Text>

// // //         <View style={styles.calendarBox}>

// // //           {/* DATE */}
// // //           <TouchableOpacity onPress={() => setShowDate(true)} style={styles.dateRow}>
// // //             <Text style={[styles.dateText, { color: theme.text }]}>
// // //               {date.toLocaleDateString()}
// // //             </Text>
// // //             <Icon name="calendar-outline" size={18} color={theme.text} />
// // //           </TouchableOpacity>

// // //           {/* TIME */}
// // //           <TouchableOpacity onPress={() => setShowTime(true)} style={styles.dateRow}>
// // //             <Text style={[styles.dateText, { color: theme.text }]}>
// // //               {date.toLocaleTimeString()}
// // //             </Text>
// // //             <Icon name="time-outline" size={18} color={theme.text} />
// // //           </TouchableOpacity>

// // //           {/* DATE PICKER */}
// // //           {showDate && (
// // //             <DateTimePicker
// // //               value={date}
// // //               mode="date"
// // //               display="calendar"
// // //               onChange={onChangeDate}
// // //             />
// // //           )}

// // //           {/* TIME PICKER */}
// // //           {showTime && (
// // //             <DateTimePicker
// // //               value={date}
// // //               mode="time"
// // //               display="spinner"
// // //               onChange={onChangeTime}
// // //             />
// // //           )}

// // //         </View>

// // //         {/* DROPDOWN */}
// // //         <TouchableOpacity
// // //           style={styles.dropdown}
// // //           onPress={() => navigation.navigate("ForwardTaskTo")}
// // //         >
// // //           <Text style={{ fontWeight: '600' }}>ADD TASK FOR</Text>
// // //           <Icon name="chevron-down" size={18} color={theme.text} />
// // //         </TouchableOpacity>

// // //         {/* BUTTONS */}
// // //         <View style={styles.btnRow}>
// // //           <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
// // //             <Text style={styles.btnText}>CANCEL</Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity style={styles.btn} onPress={AddTask}>
// // //             {loading ? (
// // //               <ActivityIndicator color="#fff" />
// // //             ) : (
// // //               <Text style={styles.btnText}>ADD</Text>
// // //             )}
// // //           </TouchableOpacity>
// // //         </View>

// // //       </ScrollView>

// // //       {/* BOTTOM NAV */}
// // //       <View style={[styles.bottom, { backgroundColor: theme.bottomNav }]}>
// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('HomeDashboard')}>
// // //           <Icon name="home" size={24} color="#fff" />
// // //         </TouchableOpacity>

// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AddMember')}>
// // //           <Icon name="person-add" size={24} color="#fff" />
// // //         </TouchableOpacity>

// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('TimeBasedHistoryScreen')}>
// // //           <Icon name="time" size={24} color="#fff" />
// // //         </TouchableOpacity>

// // //         <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SettingScreen')}>
// // //           <Icon name="settings" size={24} color="#fff" />
// // //         </TouchableOpacity>
// // //       </View>

// // //     </SafeAreaView>
// // //   );
// // // };

// // // export default AddTaskTimeBased;

// // // const styles = StyleSheet.create({
// // //   container: { flex: 1, backgroundColor: '#B7C9DB' },
// // //   content: { padding: 20, paddingBottom: 120 },

// // //   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
// // //   headerBox: { backgroundColor: '#fff', padding: 10, borderRadius: 10 },
// // //   headerText: { fontWeight: '800' },

// // //   card: { backgroundColor: '#EDEDED', borderRadius: 12, padding: 14, marginTop: 18 },
// // //   label: { fontWeight: '800' },

// // //   section: { marginTop: 20, fontWeight: '800' },

// // //   radioRow: { flexDirection: 'row', marginTop: 10 },
// // //   radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: 25 },

// // //   radioOuter: {
// // //     width: 18,
// // //     height: 18,
// // //     borderRadius: 9,
// // //     borderWidth: 2,
// // //     marginRight: 6,
// // //     alignItems: 'center',
// // //     justifyContent: 'center'
// // //   },

// // //   radioInner: { width: 8, height: 8, backgroundColor: '#000', borderRadius: 4 },

// // //   calendarBox: {
// // //     marginTop: 10,
// // //     backgroundColor: '#EDEDED',
// // //     borderRadius: 10,
// // //     padding: 10
// // //   },

// // //   dateRow: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     paddingVertical: 12
// // //   },

// // //   dateText: { fontSize: 14 },

// // //   dropdown: {
// // //     marginTop: 20,
// // //     backgroundColor: '#EDEDED',
// // //     borderRadius: 25,
// // //     padding: 14,
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between'
// // //   },

// // //   btnRow: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     marginTop: 30
// // //   },

// // //   btn: {
// // //     width: '45%',
// // //     backgroundColor: '#000',
// // //     padding: 14,
// // //     borderRadius: 30,
// // //     alignItems: 'center'
// // //   },

// // //   btnText: { color: '#fff', fontWeight: '800' },

// // //   bottom: {
// // //     position: 'absolute',
// // //     bottom: 0,
// // //     width: '100%',
// // //     height: 65,
// // //     backgroundColor: '#3A3F45',
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-around',
// // //     alignItems: 'center'
// // //   },

// // //   iconBtn: {
// // //     flex: 1,
// // //     alignItems: 'center',
// // //     justifyContent: 'center'
// // //   },
// // // });