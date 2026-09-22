import React, { useEffect, useState } from "react";
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
  Modal,
  FlatList,
} from "react-native";

import Icon from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "../../context/ThemeContext";
import { BASE_URL } from "../../config/api";

const { width } = Dimensions.get("window");

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
  const [membersLoading, setMembersLoading] = useState(false);

  const [groupMembers, setGroupMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const groupIdParam = route?.params?.groupId || null;

  const isGroupTask =
    groupIdParam !== null &&
    groupIdParam !== undefined &&
    String(groupIdParam).trim() !== "";

  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert("Session Expired", "Please login again.", [
          {
            text: "OK",
            onPress: () => goToLogin(navigation),
          },
        ]);

        return null;
      }

      return token;
    } catch (error) {
      console.log("Get Token Error:", error);
      return null;
    }
  };

  const apiFetch = async (endpoint, options = {}) => {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    let data = null;

    try {
      const text = await response.text();

      if (text) {
        data = JSON.parse(text);
      }
    } catch (error) {
      console.log("Response JSON Parse Error:", error);
      data = null;
    }

    console.log(
      `API ${options.method || "GET"} ${endpoint}:`,
      response.status,
      data
    );

    if (response.status === 401) {
      await AsyncStorage.removeItem("token");

      Alert.alert("Session Expired", "Please login again.", [
        {
          text: "OK",
          onPress: () => goToLogin(navigation),
        },
      ]);

      throw new Error("Session expired");
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  const normalizeMember = (member, index) => {
    const userId =
      member?.userId ??
      member?.UserId ??
      member?.id ??
      member?.Id ??
      null;

    const name =
      member?.displayName ||
      member?.name ||
      member?.fullName ||
      member?.Name ||
      "Unknown Member";

    const phone =
      member?.phone ||
      member?.phoneNumber ||
      member?.Phone ||
      member?.PhoneNumber ||
      "";

    const isRegistered =
      member?.isRegistered !== undefined
        ? Boolean(member.isRegistered)
        : userId !== null && Number(userId) > 0;

    return {
      ...member,
      id: userId,
      userId,
      name: String(name).trim() || "Unknown Member",
      phone: String(phone).trim(),
      isRegistered,
      uniqueKey: `${userId || "member"}-${index}`,
    };
  };

  const fetchGroupMembers = async () => {
    if (!isGroupTask) {
      setGroupMembers([]);
      setSelectedMembers([]);
      return;
    }

    try {
      setMembersLoading(true);

      const response = await apiFetch("/Task/groups");

      const groups = Array.isArray(response?.data)
        ? response.data
        : [];

      const selectedGroup = groups.find(
        (group) =>
          String(group?.id) === String(groupIdParam)
      );

      if (!selectedGroup) {
        setGroupMembers([]);
        setSelectedMembers([]);
        return;
      }

      const members = Array.isArray(selectedGroup?.members)
        ? selectedGroup.members
        : [];

      const normalizedMembers = members
        .map(normalizeMember)
        .filter(
          (member) =>
            member.isRegistered &&
            member.userId !== null &&
            Number(member.userId) > 0
        );

      setGroupMembers(normalizedMembers);
    } catch (error) {
      console.log("Fetch Group Members Error:", error);

      if (
        error?.message !== "Authentication required" &&
        error?.message !== "Session expired"
      ) {
        Alert.alert(
          "Error",
          error?.message || "Failed to load group members."
        );
      }
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupMembers();
  }, [groupIdParam]);

  const onChangeDate = (event, selectedDate) => {
    setShowDate(false);

    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleTimeBasedNavigation = () => {
    setTaskType("time");

    const params = {};

    if (isGroupTask) {
      params.groupId = Number(groupIdParam);
    }

    navigation.navigate("AddTaskTimeBased", params);
  };

  const isMemberSelected = (member) => {
    if (!member?.userId) {
      return false;
    }

    return selectedMembers.some(
      (selected) =>
        Number(selected.userId) === Number(member.userId)
    );
  };

  const handleToggleMember = (member) => {
    if (!member?.userId) {
      Alert.alert(
        "Invalid Member",
        "This member cannot be mentioned because they do not have a registered user account."
      );
      return;
    }

    const memberId = Number(member.userId);

    setSelectedMembers((currentSelected) => {
      const alreadySelected = currentSelected.some(
        (selected) =>
          Number(selected.userId) === memberId
      );

      if (alreadySelected) {
        return currentSelected.filter(
          (selected) =>
            Number(selected.userId) !== memberId
        );
      }

      return [...currentSelected, member];
    });
  };

  const handleRemoveMention = (userId) => {
    setSelectedMembers((currentSelected) =>
      currentSelected.filter(
        (member) =>
          Number(member.userId) !== Number(userId)
      )
    );
  };

  const handleClearAllMentions = () => {
    setSelectedMembers([]);
  };

  const closeMemberModal = () => {
    setShowMemberModal(false);
    setMemberSearch("");
  };

  const mentionUsers = async (taskId) => {
    if (!taskId) {
      return {
        success: false,
        error: new Error(
          "Task ID was not returned by the server."
        ),
      };
    }

    const mentionedUserIds = selectedMembers
      .map((member) => Number(member?.userId))
      .filter(
        (id) =>
          Number.isInteger(id) && id > 0
      )
      .filter(
        (id, index, array) =>
          array.indexOf(id) === index
      );

    try {
      const requestBody = {
        MentionedUserIds: mentionedUserIds,
      };

      console.log(
        "Mention Users Request:",
        requestBody
      );

      const response = await apiFetch(
        `/Task/${taskId}/mention`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        }
      );

      console.log(
        "Mention Users Response:",
        response
      );

      if (response?.success === false) {
        throw new Error(
          response?.message ||
            "Failed to process mentions."
        );
      }

      return {
        success: true,
        mentionedUserIds,
        data: Array.isArray(response?.data)
          ? response.data
          : [],
        alreadyMentionedUserIds:
          Array.isArray(
            response?.alreadyMentionedUserIds
          )
            ? response.alreadyMentionedUserIds
            : [],
        message:
          response?.message || "",
        response,
      };
    } catch (error) {
      console.log("Mention Users Error:", error);

      return {
        success: false,
        error,
      };
    }
  };

  const extractTaskId = (data) => {
    const possibleId =
      data?.data?.id ??
      data?.data?.taskId ??
      data?.taskId ??
      data?.id;

    if (
      possibleId !== undefined &&
      possibleId !== null &&
      Number(possibleId) > 0
    ) {
      return Number(possibleId);
    }

    return null;
  };

  const AddTask = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    if (isGroupTask && membersLoading) {
      Alert.alert(
        "Please wait",
        "Group members are still loading."
      );
      return;
    }

    const token = await getToken();

    if (!token) {
      return;
    }

    try {
      setLoading(true);

      const requestBody = {
        title: title.trim(),
        description: description.trim(),
        dueDate: toDateOnlyString(date),
        isTimeBased: false,
        groupId: isGroupTask
          ? Number(groupIdParam)
          : null,
      };

      console.log(
        "Creating Task:",
        requestBody
      );

      const response = await fetch(
        `${BASE_URL}/Managment/task`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      let data = null;

      try {
        const text = await response.text();

        if (text) {
          data = JSON.parse(text);
        }
      } catch (jsonError) {
        console.log(
          "Create Task JSON Error:",
          jsonError
        );
      }

      console.log(
        "Add Task Response:",
        response.status,
        data
      );

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.message ||
            `Failed to create task. Status: ${response.status}`
        );
      }

      const taskId = extractTaskId(data);

      console.log(
        "Created Task ID:",
        taskId
      );

      let mentionResult = null;

      if (isGroupTask) {
        if (!taskId) {
          if (selectedMembers.length > 0) {
            Alert.alert(
              "Task Created",
              "The task was created, but the server did not return the task ID, so the selected members could not be mentioned.",
              [
                {
                  text: "OK",
                  onPress: () =>
                    navigation.goBack(),
                },
              ]
            );

            return;
          }
        } else {
          mentionResult =
            await mentionUsers(taskId);
        }
      }

      if (
        mentionResult &&
        mentionResult.success === false
      ) {
        Alert.alert(
          "Task Created",
          `The task was created successfully, but the mention request failed.\n\nReason: ${
            mentionResult.error?.message ||
            "Unknown error"
          }`,
          [
            {
              text: "OK",
              onPress: () =>
                navigation.goBack(),
            },
          ]
        );

        return;
      }

      let successMessage =
        data?.message ||
        "Task created successfully.";

      if (isGroupTask) {
        if (
          selectedMembers.length === 0
        ) {
          successMessage +=
            "\n\nNo group members were mentioned.";
        } else if (
          mentionResult?.alreadyMentionedUserIds
            ?.length ===
          selectedMembers.length
        ) {
          successMessage +=
            "\n\nAll selected members were already mentioned for this task.";
        } else if (
          mentionResult?.data?.length > 0
        ) {
          const mentionedCount =
            mentionResult.data.length;

          if (mentionedCount === 1) {
            successMessage +=
              "\n\n1 group member was mentioned successfully.";
          } else {
            successMessage += `\n\n${mentionedCount} group members were mentioned successfully.`;
          }

          if (
            mentionResult
              ?.alreadyMentionedUserIds
              ?.length > 0
          ) {
            successMessage += `\n${mentionResult.alreadyMentionedUserIds.length} selected member(s) were already mentioned.`;
          }
        } else if (
          mentionResult?.message
        ) {
          successMessage += `\n\n${mentionResult.message}`;
        }
      }

      Alert.alert(
        "Success",
        successMessage,
        [
          {
            text: "OK",
            onPress: () =>
              navigation.goBack(),
          },
        ]
      );

      setTitle("");
      setDescription("");
      setDate(new Date());
      setSelectedMembers([]);
    } catch (error) {
      console.log(
        "Add Task Error:",
        error
      );

      if (
        error?.message ===
        "Network request failed"
      ) {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else if (
        error?.message ===
        "Authentication required"
      ) {
        return;
      } else if (
        error?.message ===
        "Session expired"
      ) {
        return;
      } else {
        Alert.alert(
          "Error",
          error?.message ||
            "Server not reachable."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers =
    groupMembers.filter((member) => {
      const search =
        memberSearch.trim().toLowerCase();

      if (!search) {
        return true;
      }

      return (
        member.name
          .toLowerCase()
          .includes(search) ||
        member.phone
          .toLowerCase()
          .includes(search)
      );
    });

  const primaryColor =
    theme.primary || "#2563EB";

  const cardBg =
    theme.card || "#FFFFFF";

  const textColor =
    theme.text || "#0F172A";

  const subTextColor =
    theme.subText || "#64748B";

  const borderClr =
    theme.border || "#E2E8F0";

  const inputBg =
    theme.inputBg ||
    (theme.bg === "#000000" ||
    theme.bg === "#0F172A"
      ? "#1E293B"
      : "#F8FAFC");

  const isDark =
    theme.bg === "#000000" ||
    theme.bg === "#0F172A";

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.bg,
        },
      ]}
    >
      <StatusBar
        barStyle={
          isDark
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={theme.bg}
      />

      <View
        style={[
          styles.header,
          {
            backgroundColor:
              theme.bg,
            borderBottomColor:
              borderClr,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            navigation.goBack()
          }
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Icon
            name="arrow-back"
            size={24}
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
        showsVerticalScrollIndicator={
          false
        }
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
                backgroundColor:
                  cardBg,
                borderColor:
                  borderClr,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color:
                    textColor,
                },
              ]}
            >
              Task Title
            </Text>

            <TextInput
              placeholder="e.g. Design System Documentation"
              placeholderTextColor={
                subTextColor
              }
              style={[
                styles.input,
                {
                  color:
                    textColor,
                  backgroundColor:
                    inputBg,
                  borderColor:
                    borderClr,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              editable={!loading}
            />
          </View>

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
            <Text
              style={[
                styles.label,
                {
                  color:
                    textColor,
                },
              ]}
            >
              Description
            </Text>

            <TextInput
              placeholder="Provide context or instructions for this task..."
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
                  color:
                    textColor,
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
              editable={!loading}
            />
          </View>

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
            <Text
              style={[
                styles.label,
                {
                  color:
                    textColor,
                },
              ]}
            >
              Task Mode
            </Text>

            <View
              style={
                styles.radioContainer
              }
            >
              <TouchableOpacity
                onPress={
                  handleTimeBasedNavigation
                }
                style={[
                  styles.radioItem,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      primaryColor,
                  },
                ]}
                activeOpacity={0.7}
                disabled={loading}
              >
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor:
                        primaryColor,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radioInner,
                      {
                        backgroundColor:
                          primaryColor,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.radioText,
                    {
                      color:
                        textColor,
                      fontWeight:
                        "700",
                    },
                  ]}
                >
                  Time Based
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setTaskType("non")
                }
                style={[
                  styles.radioItem,
                  {
                    backgroundColor:
                      inputBg,
                    borderColor:
                      taskType ===
                      "non"
                        ? primaryColor
                        : borderClr,
                  },
                ]}
                activeOpacity={0.7}
                disabled={loading}
              >
                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor:
                        taskType ===
                        "non"
                          ? primaryColor
                          : subTextColor,
                    },
                  ]}
                >
                  {taskType ===
                    "non" && (
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
                        taskType ===
                        "non"
                          ? "700"
                          : "500",
                    },
                  ]}
                >
                  Non-Time Based
                </Text>
              </TouchableOpacity>
            </View>
          </View>

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
            <Text
              style={[
                styles.label,
                {
                  color:
                    textColor,
                },
              ]}
            >
              Due Date
            </Text>

            <TouchableOpacity
              style={[
                styles.dateSelector,
                {
                  backgroundColor:
                    inputBg,
                  borderColor:
                    borderClr,
                },
              ]}
              onPress={() =>
                setShowDate(true)
              }
              activeOpacity={0.7}
              disabled={loading}
            >
              <View
                style={
                  styles.dateInfoLeft
                }
              >
                <Icon
                  name="calendar-outline"
                  size={20}
                  color={
                    primaryColor
                  }
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
                  {date.toDateString()}
                </Text>
              </View>

              <Text
                style={[
                  styles.chooseDate,
                  {
                    color:
                      primaryColor,
                  },
                ]}
              >
                Change Date
              </Text>
            </TouchableOpacity>
          </View>

          {showDate && (
            <DateTimePicker
              value={date}
              mode="date"
              display={
                Platform.OS === "ios"
                  ? "spinner"
                  : "calendar"
              }
              onChange={
                onChangeDate
              }
            />
          )}

          {isGroupTask && (
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
                    styles.mentionTitleContainer
                  }
                >
                  <Icon
                    name="at-outline"
                    size={20}
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
                          textColor,
                      },
                    ]}
                  >
                    Mention Group Members
                  </Text>
                </View>

                {selectedMembers.length >
                  0 && (
                  <TouchableOpacity
                    onPress={
                      handleClearAllMentions
                    }
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.clearAllText,
                        {
                          color:
                            primaryColor,
                        },
                      ]}
                    >
                      Clear All
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text
                style={[
                  styles.mentionDescription,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                Select no member, one
                member, or multiple
                members to mention.
                Mentioned members will
                receive a notification.
              </Text>

              {selectedMembers.length >
              0 ? (
                <View>
                  {selectedMembers.map(
                    (member) => (
                      <View
                        key={String(
                          member.userId
                        )}
                        style={[
                          styles.selectedMemberContainer,
                          {
                            backgroundColor:
                              inputBg,
                            borderColor:
                              primaryColor,
                          },
                        ]}
                      >
                        <View
                          style={
                            styles.selectedMemberAvatar
                          }
                        >
                          <Icon
                            name="person"
                            size={20}
                            color="#FFFFFF"
                          />
                        </View>

                        <View
                          style={
                            styles.selectedMemberInfo
                          }
                        >
                          <Text
                            style={[
                              styles.selectedMemberName,
                              {
                                color:
                                  textColor,
                              },
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            {member.name}
                          </Text>

                          <Text
                            style={[
                              styles.selectedMemberPhone,
                              {
                                color:
                                  subTextColor,
                              },
                            ]}
                          >
                            {member.phone ||
                              "Registered group member"}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={
                            styles.removeMentionButton
                          }
                          onPress={() =>
                            handleRemoveMention(
                              member.userId
                            )
                          }
                          disabled={loading}
                        >
                          <Icon
                            name="close-circle"
                            size={24}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      if (
                        !membersLoading &&
                        !loading
                      ) {
                        setShowMemberModal(
                          true
                        );
                      }
                    }}
                    style={[
                      styles.addMoreMembersButton,
                      {
                        backgroundColor:
                          inputBg,
                        borderColor:
                          borderClr,
                      },
                    ]}
                    activeOpacity={0.7}
                    disabled={
                      membersLoading ||
                      loading
                    }
                  >
                    <Icon
                      name="person-add-outline"
                      size={20}
                      color={
                        primaryColor
                      }
                    />

                    <Text
                      style={[
                        styles.addMoreMembersText,
                        {
                          color:
                            primaryColor,
                        },
                      ]}
                    >
                      Add More Members
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (
                      !membersLoading &&
                      !loading
                    ) {
                      setShowMemberModal(
                        true
                      );
                    }
                  }}
                  style={[
                    styles.mentionSelector,
                    {
                      backgroundColor:
                        inputBg,
                      borderColor:
                        borderClr,
                    },
                  ]}
                  activeOpacity={0.7}
                  disabled={
                    membersLoading ||
                    loading
                  }
                >
                  <View
                    style={
                      styles.mentionSelectorLeft
                    }
                  >
                    <View
                      style={[
                        styles.mentionIconCircle,
                        {
                          backgroundColor:
                            primaryColor,
                        },
                      ]}
                    >
                      <Icon
                        name="person-add"
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>

                    <View
                      style={
                        styles.mentionSelectorTextContainer
                      }
                    >
                      <Text
                        style={[
                          styles.mentionSelectorTitle,
                          {
                            color:
                              textColor,
                          },
                        ]}
                      >
                        {membersLoading
                          ? "Loading members..."
                          : "Select members"}
                      </Text>

                      <Text
                        style={[
                          styles.mentionSelectorSubtitle,
                          {
                            color:
                              subTextColor,
                          },
                        ]}
                      >
                        {membersLoading
                          ? "Please wait"
                          : `${groupMembers.length} member${
                              groupMembers.length ===
                              1
                                ? ""
                                : "s"
                            } available`}
                      </Text>
                    </View>
                  </View>

                  {membersLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        primaryColor
                      }
                    />
                  ) : (
                    <Icon
                      name="chevron-forward"
                      size={20}
                      color={
                        subTextColor
                      }
                    />
                  )}
                </TouchableOpacity>
              )}

              {selectedMembers.length >
                0 && (
                <Text
                  style={[
                    styles.selectedCountText,
                    {
                      color:
                        primaryColor,
                    },
                  ]}
                >
                  {selectedMembers.length}{" "}
                  member
                  {selectedMembers.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  selected
                </Text>
              )}

              {groupMembers.length ===
                0 &&
                !membersLoading && (
                  <Text
                    style={[
                      styles.noMembersText,
                      {
                        color:
                          subTextColor,
                      },
                    ]}
                  >
                    No registered group
                    members are available
                    to mention.
                  </Text>
                )}
            </View>
          )}

          <View style={styles.btnRow}>
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
              disabled={
                loading ||
                taskType !== "non"
              }
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
                ? "#1E293B"
                : "#0F172A"),
            borderTopColor:
              borderClr,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            navigation.navigate(
              "HomeDashboard"
            )
          }
        >
          <Icon
            name="home"
            size={22}
            color="#FFFFFF"
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
              "AddMember"
            )
          }
        >
          <Icon
            name="person-add"
            size={22}
            color="#FFFFFF"
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
              "TimeBasedHistoryScreen"
            )
          }
        >
          <Icon
            name="time"
            size={22}
            color="#FFFFFF"
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
              "SettingScreen"
            )
          }
        >
          <Icon
            name="settings"
            size={22}
            color="#FFFFFF"
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

      <Modal
        visible={showMemberModal}
        transparent
        animationType="slide"
        onRequestClose={
          closeMemberModal
        }
      >
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor:
                "rgba(0,0,0,0.55)",
            },
          ]}
        >
          <View
            style={[
              styles.memberModal,
              {
                backgroundColor:
                  cardBg,
              },
            ]}
          >
            <View
              style={styles.modalHeader}
            >
              <View>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color:
                        textColor,
                    },
                  ]}
                >
                  Mention Members
                </Text>

                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color:
                        subTextColor,
                    },
                  ]}
                >
                  Select none, one, or
                  multiple members
                </Text>
              </View>

              <TouchableOpacity
                onPress={
                  closeMemberModal
                }
                style={
                  styles.modalCloseButton
                }
              >
                <Icon
                  name="close"
                  size={24}
                  color={textColor}
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor:
                    inputBg,
                  borderColor:
                    borderClr,
                },
              ]}
            >
              <Icon
                name="search"
                size={19}
                color={
                  subTextColor
                }
              />

              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color:
                      textColor,
                  },
                ]}
                placeholder="Search member..."
                placeholderTextColor={
                  subTextColor
                }
                value={memberSearch}
                onChangeText={
                  setMemberSearch
                }
                autoCorrect={false}
              />

              {memberSearch.length >
                0 && (
                <TouchableOpacity
                  onPress={() =>
                    setMemberSearch("")
                  }
                >
                  <Icon
                    name="close-circle"
                    size={19}
                    color={
                      subTextColor
                    }
                  />
                </TouchableOpacity>
              )}
            </View>

            <View
              style={
                styles.modalSelectedBar
              }
            >
              <Text
                style={[
                  styles.modalSelectedCount,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                {selectedMembers.length}{" "}
                selected
              </Text>

              {selectedMembers.length >
                0 && (
                <TouchableOpacity
                  onPress={
                    handleClearAllMentions
                  }
                >
                  <Text
                    style={[
                      styles.clearAllText,
                      {
                        color:
                          primaryColor,
                      },
                    ]}
                  >
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredMembers}
              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item.uniqueKey ||
                    `${item.userId}-${index}`
                )
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                filteredMembers.length ===
                0
                  ? styles.emptyMemberList
                  : styles.memberList
              }
              renderItem={({
                item,
              }) => {
                const selected =
                  isMemberSelected(
                    item
                  );

                return (
                  <TouchableOpacity
                    style={[
                      styles.memberItem,
                      {
                        backgroundColor:
                          selected
                            ? `${primaryColor}15`
                            : inputBg,
                        borderColor:
                          selected
                            ? primaryColor
                            : borderClr,
                      },
                    ]}
                    onPress={() =>
                      handleToggleMember(
                        item
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.memberAvatar,
                        {
                          backgroundColor:
                            selected
                              ? primaryColor
                              : "#2563EB",
                        },
                      ]}
                    >
                      <Icon
                        name="person"
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>

                    <View
                      style={
                        styles.memberItemInfo
                      }
                    >
                      <Text
                        style={[
                          styles.memberItemName,
                          {
                            color:
                              textColor,
                          },
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {item.name}
                      </Text>

                      <Text
                        style={[
                          styles.memberItemPhone,
                          {
                            color:
                              subTextColor,
                          },
                        ]}
                      >
                        {item.phone ||
                          "Registered group member"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.checkCircle,
                        {
                          borderColor:
                            selected
                              ? primaryColor
                              : subTextColor,
                          backgroundColor:
                            selected
                              ? primaryColor
                              : "transparent",
                        },
                      ]}
                    >
                      {selected && (
                        <Icon
                          name="checkmark"
                          size={16}
                          color="#FFFFFF"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View
                  style={
                    styles.emptyMemberContainer
                  }
                >
                  <Icon
                    name="people-outline"
                    size={42}
                    color={
                      subTextColor
                    }
                  />

                  <Text
                    style={[
                      styles.emptyMemberTitle,
                      {
                        color:
                          textColor,
                      },
                    ]}
                  >
                    No members found
                  </Text>

                  <Text
                    style={[
                      styles.emptyMemberText,
                      {
                        color:
                          subTextColor,
                      },
                    ]}
                  >
                    Try another search
                    term.
                  </Text>
                </View>
              }
            />

            <TouchableOpacity
              style={[
                styles.doneSelectingButton,
                {
                  backgroundColor:
                    primaryColor,
                },
              ]}
              onPress={
                closeMemberModal
              }
              activeOpacity={0.8}
            >
              <Text
                style={
                  styles.doneSelectingText
                }
              >
                DONE
                {selectedMembers.length >
                0
                  ? ` (${selectedMembers.length})`
                  : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AddTaskNonTimeBased;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

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

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },

  responsiveWrapper: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },

  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
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

  radioContainer: {
    flexDirection:
      width < 360
        ? "column"
        : "row",
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

  mentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mentionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  mentionLabel: {
    marginBottom: 0,
    marginLeft: 8,
  },

  clearAllText: {
    fontSize: 12,
    fontWeight: "700",
  },

  mentionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 12,
  },

  mentionSelector: {
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mentionSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  mentionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  mentionSelectorTextContainer: {
    flex: 1,
  },

  mentionSelectorTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  mentionSelectorSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },

  selectedMemberContainer: {
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  selectedMemberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  selectedMemberInfo: {
    flex: 1,
  },

  selectedMemberName: {
    fontSize: 14,
    fontWeight: "700",
  },

  selectedMemberPhone: {
    fontSize: 11,
    marginTop: 3,
  },

  removeMentionButton: {
    padding: 5,
  },

  addMoreMembersButton: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },

  addMoreMembersText: {
    fontSize: 13,
    fontWeight: "700",
  },

  selectedCountText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },

  noMembersText: {
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },

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
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

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
    shadowOffset: {
      width: 0,
      height: -3,
    },
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

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  memberModal: {
    width: "100%",
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  modalSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },

  searchContainer: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 0,
  },

  modalSelectedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
    marginBottom: 6,
  },

  modalSelectedCount: {
    fontSize: 12,
    fontWeight: "700",
  },

  memberList: {
    paddingBottom: 10,
  },

  memberItem: {
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 9,
  },

  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  memberItemInfo: {
    flex: 1,
  },

  memberItemName: {
    fontSize: 14,
    fontWeight: "700",
  },

  memberItemPhone: {
    fontSize: 11,
    marginTop: 3,
  },

  checkCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  emptyMemberList: {
    flexGrow: 1,
    justifyContent: "center",
  },

  emptyMemberContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  emptyMemberTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },

  emptyMemberText: {
    fontSize: 12,
    marginTop: 4,
  },

  doneSelectingButton: {
    minHeight: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },

  doneSelectingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});






























// import React, { useEffect, useState } from "react";
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
//   Platform,
//   StatusBar,
//   Dimensions,
//   Modal,
//   FlatList,
// } from "react-native";

// import Icon from "@react-native-vector-icons/ionicons";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import DateTimePicker from "@react-native-community/datetimepicker";

// import { useTheme } from "../../context/ThemeContext";
// import { BASE_URL } from "../../config/api";

// const { width } = Dimensions.get("window");

// const goToLogin = (navigation) => {
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

// const toDateOnlyString = (d) => {
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
//   const [membersLoading, setMembersLoading] = useState(false);

//   const [groupMembers, setGroupMembers] = useState([]);
//   const [selectedMember, setSelectedMember] = useState(null);

//   const [showMemberModal, setShowMemberModal] = useState(false);
//   const [memberSearch, setMemberSearch] = useState("");

//   const groupIdParam = route?.params?.groupId || null;

//   const isGroupTask =
//     groupIdParam !== null &&
//     groupIdParam !== undefined &&
//     String(groupIdParam).trim() !== "";

//   const getToken = async () => {
//     try {
//       const token = await AsyncStorage.getItem("token");

//       if (!token) {
//         Alert.alert("Session Expired", "Please login again.", [
//           {
//             text: "OK",
//             onPress: () => goToLogin(navigation),
//           },
//         ]);

//         return null;
//       }

//       return token;
//     } catch (error) {
//       console.log("Get Token Error:", error);
//       return null;
//     }
//   };

//   const apiFetch = async (endpoint, options = {}) => {
//     const token = await getToken();

//     if (!token) {
//       throw new Error("Authentication required");
//     }

//     const response = await fetch(`${BASE_URL}${endpoint}`, {
//       ...options,
//       headers: {
//         Accept: "application/json",
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//         ...(options.headers || {}),
//       },
//     });

//     let data = null;

//     try {
//       const text = await response.text();

//       if (text) {
//         data = JSON.parse(text);
//       }
//     } catch (error) {
//       console.log("Response JSON Parse Error:", error);
//       data = null;
//     }

//     console.log(
//       `API ${options.method || "GET"} ${endpoint}:`,
//       response.status,
//       data
//     );

//     if (response.status === 401) {
//       await AsyncStorage.removeItem("token");

//       Alert.alert("Session Expired", "Please login again.", [
//         {
//           text: "OK",
//           onPress: () => goToLogin(navigation),
//         },
//       ]);

//       throw new Error("Session expired");
//     }

//     if (!response.ok) {
//       throw new Error(
//         data?.message ||
//           data?.error ||
//           `Request failed with status ${response.status}`
//       );
//     }

//     return data;
//   };

//   const normalizeMember = (member, index) => {
//     const userId =
//       member?.userId ??
//       member?.UserId ??
//       member?.id ??
//       member?.Id ??
//       null;

//     const name =
//       member?.displayName ||
//       member?.name ||
//       member?.fullName ||
//       member?.Name ||
//       "Unknown Member";

//     const phone =
//       member?.phone ||
//       member?.phoneNumber ||
//       member?.Phone ||
//       member?.PhoneNumber ||
//       "";

//     const isRegistered =
//       member?.isRegistered !== undefined
//         ? Boolean(member.isRegistered)
//         : userId !== null && Number(userId) > 0;

//     return {
//       ...member,
//       id: userId,
//       userId: userId,
//       name: String(name).trim() || "Unknown Member",
//       phone: String(phone).trim(),
//       isRegistered,
//       uniqueKey: `${userId || "member"}-${index}`,
//     };
//   };

//   const fetchGroupMembers = async () => {
//     if (!isGroupTask) {
//       setGroupMembers([]);
//       return;
//     }

//     try {
//       setMembersLoading(true);

//       const response = await apiFetch("/Task/groups");

//       console.log("Groups Response for Mention:", response);

//       const groups = Array.isArray(response?.data)
//         ? response.data
//         : [];

//       const selectedGroup = groups.find(
//         (group) => String(group?.id) === String(groupIdParam)
//       );

//       if (!selectedGroup) {
//         console.log(
//           "Selected group not found for mention:",
//           groupIdParam
//         );

//         setGroupMembers([]);
//         return;
//       }

//       const members = Array.isArray(selectedGroup?.members)
//         ? selectedGroup.members
//         : [];

//       const normalizedMembers = members
//         .map(normalizeMember)
//         .filter(
//           (member) =>
//             member.isRegistered &&
//             member.userId !== null &&
//             Number(member.userId) > 0
//         );

//       setGroupMembers(normalizedMembers);

//       console.log(
//         "Group Members available for mention:",
//         normalizedMembers
//       );
//     } catch (error) {
//       console.log("Fetch Group Members Error:", error);

//       if (
//         error?.message !== "Authentication required" &&
//         error?.message !== "Session expired"
//       ) {
//         Alert.alert(
//           "Error",
//           error?.message || "Failed to load group members."
//         );
//       }
//     } finally {
//       setMembersLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchGroupMembers();
//   }, [groupIdParam]);

//   const onChangeDate = (event, selectedDate) => {
//     setShowDate(false);

//     if (selectedDate) {
//       setDate(selectedDate);
//     }
//   };

//   const handleTimeBasedNavigation = () => {
//     setTaskType("time");

//     const params = {};

//     if (isGroupTask) {
//       params.groupId = Number(groupIdParam);
//     }

//     navigation.navigate("AddTaskTimeBased", params);
//   };

//   const handleSelectMember = (member) => {
//     if (!member?.userId) {
//       Alert.alert(
//         "Invalid Member",
//         "This member cannot be mentioned because they do not have a registered user account."
//       );
//       return;
//     }

//     setSelectedMember(member);
//     setShowMemberModal(false);
//     setMemberSearch("");
//   };

//   const handleRemoveMention = () => {
//     setSelectedMember(null);
//   };

//   const mentionUser = async (taskId) => {
//     if (!taskId || !selectedMember?.userId) {
//       return {
//         success: true,
//         skipped: true,
//       };
//     }

//     try {
//       const response = await apiFetch(`/Task/${taskId}/mention`, {
//         method: "POST",
//         body: JSON.stringify({
//           MentionedUserId: Number(selectedMember.userId),
//         }),
//       });

//       console.log("Mention User Response:", response);

//       if (response?.success === false) {
//         throw new Error(
//           response?.message || "Failed to mention member."
//         );
//       }

//       return {
//         success: true,
//         data: response?.data,
//       };
//     } catch (error) {
//       console.log("Mention User Error:", error);

//       return {
//         success: false,
//         error,
//       };
//     }
//   };

//   const extractTaskId = (data) => {
//     const possibleId =
//       data?.data?.id ??
//       data?.data?.taskId ??
//       data?.taskId ??
//       data?.id;

//     if (
//       possibleId !== undefined &&
//       possibleId !== null &&
//       Number(possibleId) > 0
//     ) {
//       return Number(possibleId);
//     }

//     return null;
//   };

//   const AddTask = async () => {
//     if (!title.trim() || !description.trim()) {
//       Alert.alert("Error", "Please fill all fields.");
//       return;
//     }

//     if (isGroupTask && membersLoading) {
//       Alert.alert(
//         "Please wait",
//         "Group members are still loading."
//       );
//       return;
//     }

//     const token = await getToken();

//     if (!token) {
//       return;
//     }

//     try {
//       setLoading(true);

//       const requestBody = {
//         title: title.trim(),
//         description: description.trim(),
//         dueDate: toDateOnlyString(date),
//         isTimeBased: false,
//         groupId: isGroupTask
//           ? Number(groupIdParam)
//           : null,
//       };

//       console.log("Creating Task:", requestBody);

//       const response = await fetch(`${BASE_URL}/Managment/task`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Accept: "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify(requestBody),
//       });

//       let data = null;

//       try {
//         const text = await response.text();

//         if (text) {
//           data = JSON.parse(text);
//         }
//       } catch (jsonError) {
//         console.log("Create Task JSON Error:", jsonError);
//       }

//       console.log(
//         "Add Task Response:",
//         response.status,
//         data
//       );

//       if (!response.ok || data?.success === false) {
//         throw new Error(
//           data?.message ||
//             `Failed to create task. Status: ${response.status}`
//         );
//       }

//       const taskId = extractTaskId(data);

//       console.log("Created Task ID:", taskId);

//       let mentionResult = null;

//       if (
//         isGroupTask &&
//         selectedMember &&
//         taskId
//       ) {
//         mentionResult = await mentionUser(taskId);
//       }

//       if (
//         isGroupTask &&
//         selectedMember &&
//         !taskId
//       ) {
//         Alert.alert(
//           "Task Created",
//           "The task was created, but the server did not return the task ID, so the member could not be mentioned.",
//           [
//             {
//               text: "OK",
//               onPress: () => navigation.goBack(),
//             },
//           ]
//         );

//         return;
//       }

//       if (
//         mentionResult &&
//         mentionResult.success === false
//       ) {
//         Alert.alert(
//           "Task Created",
//           `The task was created successfully, but ${selectedMember.name} could not be mentioned.\n\nReason: ${
//             mentionResult.error?.message ||
//             "Unknown error"
//           }`,
//           [
//             {
//               text: "OK",
//               onPress: () => navigation.goBack(),
//             },
//           ]
//         );

//         return;
//       }

//       let successMessage =
//         data?.message || "Task created successfully.";

//       if (
//         selectedMember &&
//         mentionResult?.success
//       ) {
//         successMessage += `\n\n${selectedMember.name} was mentioned successfully.`;
//       }

//       Alert.alert("Success", successMessage, [
//         {
//           text: "OK",
//           onPress: () => navigation.goBack(),
//         },
//       ]);

//       setTitle("");
//       setDescription("");
//       setDate(new Date());
//       setSelectedMember(null);
//     } catch (error) {
//       console.log("Add Task Error:", error);

//       if (error?.message === "Network request failed") {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else if (
//         error?.message === "Authentication required"
//       ) {
//         return;
//       } else if (
//         error?.message === "Session expired"
//       ) {
//         return;
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message || "Server not reachable."
//         );
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const filteredMembers = groupMembers.filter((member) => {
//     const search = memberSearch.trim().toLowerCase();

//     if (!search) {
//       return true;
//     }

//     return (
//       member.name.toLowerCase().includes(search) ||
//       member.phone.toLowerCase().includes(search)
//     );
//   });

//   const primaryColor = theme.primary || "#2563EB";
//   const cardBg = theme.card || "#FFFFFF";
//   const textColor = theme.text || "#0F172A";
//   const subTextColor = theme.subText || "#64748B";
//   const borderClr = theme.border || "#E2E8F0";

//   const inputBg =
//     theme.inputBg ||
//     (theme.bg === "#000000" ||
//     theme.bg === "#0F172A"
//       ? "#1E293B"
//       : "#F8FAFC");

//   const isDark =
//     theme.bg === "#000000" ||
//     theme.bg === "#0F172A";

//   return (
//     <SafeAreaView
//       style={[
//         styles.container,
//         {
//           backgroundColor: theme.bg,
//         },
//       ]}
//     >
//       <StatusBar
//         barStyle={
//           isDark
//             ? "light-content"
//             : "dark-content"
//         }
//         backgroundColor={theme.bg}
//       />

//       <View
//         style={[
//           styles.header,
//           {
//             backgroundColor: theme.bg,
//             borderBottomColor: borderClr,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           style={styles.backBtn}
//           activeOpacity={0.7}
//           accessibilityRole="button"
//           accessibilityLabel="Go back"
//         >
//           <Icon
//             name="arrow-back"
//             size={24}
//             color={textColor}
//           />
//         </TouchableOpacity>

//         <View
//           style={[
//             styles.headerBox,
//             {
//               backgroundColor:
//                 theme.headerBox || inputBg,
//             },
//           ]}
//         >
//           <Text
//             style={[
//               styles.headerText,
//               {
//                 color: textColor,
//               },
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
//                 {
//                   color: textColor,
//                 },
//               ]}
//             >
//               Task Title
//             </Text>

//             <TextInput
//               placeholder="e.g. Design System Documentation"
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
//               editable={!loading}
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
//                 {
//                   color: textColor,
//                 },
//               ]}
//             >
//               Description
//             </Text>

//             <TextInput
//               placeholder="Provide context or instructions for this task..."
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
//               editable={!loading}
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
//                 {
//                   color: textColor,
//                 },
//               ]}
//             >
//               Task Mode
//             </Text>

//             <View style={styles.radioContainer}>
//               <TouchableOpacity
//                 onPress={handleTimeBasedNavigation}
//                 style={[
//                   styles.radioItem,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor: primaryColor,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//                 disabled={loading}
//               >
//                 <View
//                   style={[
//                     styles.radioOuter,
//                     {
//                       borderColor: primaryColor,
//                     },
//                   ]}
//                 >
//                   <View
//                     style={[
//                       styles.radioInner,
//                       {
//                         backgroundColor: primaryColor,
//                       },
//                     ]}
//                   />
//                 </View>

//                 <Text
//                   style={[
//                     styles.radioText,
//                     {
//                       color: textColor,
//                       fontWeight: "700",
//                     },
//                   ]}
//                 >
//                   Time Based
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 onPress={() => setTaskType("non")}
//                 style={[
//                   styles.radioItem,
//                   {
//                     backgroundColor: inputBg,
//                     borderColor:
//                       taskType === "non"
//                         ? primaryColor
//                         : borderClr,
//                   },
//                 ]}
//                 activeOpacity={0.7}
//                 disabled={loading}
//               >
//                 <View
//                   style={[
//                     styles.radioOuter,
//                     {
//                       borderColor:
//                         taskType === "non"
//                           ? primaryColor
//                           : subTextColor,
//                     },
//                   ]}
//                 >
//                   {taskType === "non" && (
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
//                         taskType === "non"
//                           ? "700"
//                           : "500",
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
//                 {
//                   color: textColor,
//                 },
//               ]}
//             >
//               Due Date
//             </Text>

//             <TouchableOpacity
//               style={[
//                 styles.dateSelector,
//                 {
//                   backgroundColor: inputBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//               onPress={() => setShowDate(true)}
//               activeOpacity={0.7}
//               disabled={loading}
//             >
//               <View style={styles.dateInfoLeft}>
//                 <Icon
//                   name="calendar-outline"
//                   size={20}
//                   color={primaryColor}
//                 />

//                 <Text
//                   style={[
//                     styles.dateText,
//                     {
//                       color: textColor,
//                     },
//                   ]}
//                 >
//                   {date.toDateString()}
//                 </Text>
//               </View>

//               <Text
//                 style={[
//                   styles.chooseDate,
//                   {
//                     color: primaryColor,
//                   },
//                 ]}
//               >
//                 Change Date
//               </Text>
//             </TouchableOpacity>
//           </View>

//           {showDate && (
//             <DateTimePicker
//               value={date}
//               mode="date"
//               display={
//                 Platform.OS === "ios"
//                   ? "spinner"
//                   : "calendar"
//               }
//               onChange={onChangeDate}
//             />
//           )}

//           {isGroupTask && (
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
//                 <View style={styles.mentionTitleContainer}>
//                   <Icon
//                     name="at-outline"
//                     size={20}
//                     color={primaryColor}
//                   />

//                   <Text
//                     style={[
//                       styles.label,
//                       styles.mentionLabel,
//                       {
//                         color: textColor,
//                       },
//                     ]}
//                   >
//                     Mention Group Member
//                   </Text>
//                 </View>
//               </View>

//               <Text
//                 style={[
//                   styles.mentionDescription,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 Select a group member to mention in this task. They
//                 will receive a notification.
//               </Text>

//               {selectedMember ? (
//                 <View
//                   style={[
//                     styles.selectedMemberContainer,
//                     {
//                       backgroundColor: inputBg,
//                       borderColor: primaryColor,
//                     },
//                   ]}
//                 >
//                   <View style={styles.selectedMemberAvatar}>
//                     <Icon
//                       name="person"
//                       size={20}
//                       color="#FFFFFF"
//                     />
//                   </View>

//                   <View style={styles.selectedMemberInfo}>
//                     <Text
//                       style={[
//                         styles.selectedMemberName,
//                         {
//                           color: textColor,
//                         },
//                       ]}
//                       numberOfLines={1}
//                     >
//                       {selectedMember.name}
//                     </Text>

//                     {selectedMember.phone ? (
//                       <Text
//                         style={[
//                           styles.selectedMemberPhone,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         {selectedMember.phone}
//                       </Text>
//                     ) : (
//                       <Text
//                         style={[
//                           styles.selectedMemberPhone,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         Group member
//                       </Text>
//                     )}
//                   </View>

//                   <TouchableOpacity
//                     style={styles.removeMentionButton}
//                     onPress={handleRemoveMention}
//                     disabled={loading}
//                   >
//                     <Icon
//                       name="close-circle"
//                       size={24}
//                       color="#FF3B30"
//                     />
//                   </TouchableOpacity>
//                 </View>
//               ) : (
//                 <TouchableOpacity
//                   onPress={() => {
//                     if (membersLoading) {
//                       return;
//                     }

//                     setShowMemberModal(true);
//                   }}
//                   style={[
//                     styles.mentionSelector,
//                     {
//                       backgroundColor: inputBg,
//                       borderColor: borderClr,
//                     },
//                   ]}
//                   activeOpacity={0.7}
//                   disabled={membersLoading || loading}
//                 >
//                   <View style={styles.mentionSelectorLeft}>
//                     <View
//                       style={[
//                         styles.mentionIconCircle,
//                         {
//                           backgroundColor:
//                             primaryColor,
//                         },
//                       ]}
//                     >
//                       <Icon
//                         name="person-add"
//                         size={18}
//                         color="#FFFFFF"
//                       />
//                     </View>

//                     <View
//                       style={
//                         styles.mentionSelectorTextContainer
//                       }
//                     >
//                       <Text
//                         style={[
//                           styles.mentionSelectorTitle,
//                           {
//                             color: textColor,
//                           },
//                         ]}
//                       >
//                         {membersLoading
//                           ? "Loading members..."
//                           : "Select a member"}
//                       </Text>

//                       <Text
//                         style={[
//                           styles.mentionSelectorSubtitle,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         {membersLoading
//                           ? "Please wait"
//                           : `${groupMembers.length} member${
//                               groupMembers.length === 1
//                                 ? ""
//                                 : "s"
//                             } available`}
//                       </Text>
//                     </View>
//                   </View>

//                   {membersLoading ? (
//                     <ActivityIndicator
//                       size="small"
//                       color={primaryColor}
//                     />
//                   ) : (
//                     <Icon
//                       name="chevron-forward"
//                       size={20}
//                       color={subTextColor}
//                     />
//                   )}
//                 </TouchableOpacity>
//               )}

//               {groupMembers.length === 0 &&
//                 !membersLoading && (
//                   <Text
//                     style={[
//                       styles.noMembersText,
//                       {
//                         color: subTextColor,
//                       },
//                     ]}
//                   >
//                     No registered group members are available
//                     to mention.
//                   </Text>
//                 )}
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
//                   {
//                     color: textColor,
//                   },
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
//               disabled={loading || taskType !== "non"}
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
//               (isDark ? "#1E293B" : "#0F172A"),
//             borderTopColor: borderClr,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate("HomeDashboard")
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="home"
//             size={22}
//             color="#FFFFFF"
//           />

//           <Text style={styles.bottomNavText}>
//             Home
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate("AddMember")
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="person-add"
//             size={22}
//             color="#FFFFFF"
//           />

//           <Text style={styles.bottomNavText}>
//             Members
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               "TimeBasedHistoryScreen"
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="time"
//             size={22}
//             color="#FFFFFF"
//           />

//           <Text style={styles.bottomNavText}>
//             History
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={() =>
//             navigation.navigate(
//               "SettingScreen"
//             )
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="settings"
//             size={22}
//             color="#FFFFFF"
//           />

//           <Text style={styles.bottomNavText}>
//             Settings
//           </Text>
//         </TouchableOpacity>
//       </View>

//       <Modal
//         visible={showMemberModal}
//         transparent
//         animationType="slide"
//         onRequestClose={() =>
//           setShowMemberModal(false)
//         }
//       >
//         <View
//           style={[
//             styles.modalOverlay,
//             {
//               backgroundColor:
//                 "rgba(0,0,0,0.55)",
//             },
//           ]}
//         >
//           <View
//             style={[
//               styles.memberModal,
//               {
//                 backgroundColor: cardBg,
//               },
//             ]}
//           >
//             <View style={styles.modalHeader}>
//               <View>
//                 <Text
//                   style={[
//                     styles.modalTitle,
//                     {
//                       color: textColor,
//                     },
//                   ]}
//                 >
//                   Mention Member
//                 </Text>

//                 <Text
//                   style={[
//                     styles.modalSubtitle,
//                     {
//                       color: subTextColor,
//                     },
//                   ]}
//                 >
//                   Select a group member
//                 </Text>
//               </View>

//               <TouchableOpacity
//                 onPress={() => {
//                   setShowMemberModal(false);
//                   setMemberSearch("");
//                 }}
//                 style={styles.modalCloseButton}
//               >
//                 <Icon
//                   name="close"
//                   size={24}
//                   color={textColor}
//                 />
//               </TouchableOpacity>
//             </View>

//             <View
//               style={[
//                 styles.searchContainer,
//                 {
//                   backgroundColor: inputBg,
//                   borderColor: borderClr,
//                 },
//               ]}
//             >
//               <Icon
//                 name="search"
//                 size={19}
//                 color={subTextColor}
//               />

//               <TextInput
//                 style={[
//                   styles.searchInput,
//                   {
//                     color: textColor,
//                   },
//                 ]}
//                 placeholder="Search member..."
//                 placeholderTextColor={subTextColor}
//                 value={memberSearch}
//                 onChangeText={setMemberSearch}
//                 autoCorrect={false}
//               />

//               {memberSearch.length > 0 && (
//                 <TouchableOpacity
//                   onPress={() =>
//                     setMemberSearch("")
//                   }
//                 >
//                   <Icon
//                     name="close-circle"
//                     size={19}
//                     color={subTextColor}
//                   />
//                 </TouchableOpacity>
//               )}
//             </View>

//             <FlatList
//               data={filteredMembers}
//               keyExtractor={(item, index) =>
//                 String(
//                   item.uniqueKey ||
//                     `${item.userId}-${index}`
//                 )
//               }
//               keyboardShouldPersistTaps="handled"
//               showsVerticalScrollIndicator={false}
//               contentContainerStyle={
//                 filteredMembers.length === 0
//                   ? styles.emptyMemberList
//                   : styles.memberList
//               }
//               renderItem={({ item }) => (
//                 <TouchableOpacity
//                   style={[
//                     styles.memberItem,
//                     {
//                       backgroundColor: inputBg,
//                       borderColor: borderClr,
//                     },
//                   ]}
//                   onPress={() =>
//                     handleSelectMember(item)
//                   }
//                   activeOpacity={0.7}
//                 >
//                   <View style={styles.memberAvatar}>
//                     <Icon
//                       name="person"
//                       size={20}
//                       color="#FFFFFF"
//                     />
//                   </View>

//                   <View style={styles.memberItemInfo}>
//                     <Text
//                       style={[
//                         styles.memberItemName,
//                         {
//                           color: textColor,
//                         },
//                       ]}
//                       numberOfLines={1}
//                     >
//                       {item.name}
//                     </Text>

//                     {item.phone ? (
//                       <Text
//                         style={[
//                           styles.memberItemPhone,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         {item.phone}
//                       </Text>
//                     ) : (
//                       <Text
//                         style={[
//                           styles.memberItemPhone,
//                           {
//                             color: subTextColor,
//                           },
//                         ]}
//                       >
//                         Registered group member
//                       </Text>
//                     )}
//                   </View>

//                   <Icon
//                     name="at"
//                     size={22}
//                     color={primaryColor}
//                   />
//                 </TouchableOpacity>
//               )}
//               ListEmptyComponent={
//                 <View
//                   style={styles.emptyMemberContainer}
//                 >
//                   <Icon
//                     name="people-outline"
//                     size={42}
//                     color={subTextColor}
//                   />

//                   <Text
//                     style={[
//                       styles.emptyMemberTitle,
//                       {
//                         color: textColor,
//                       },
//                     ]}
//                   >
//                     No members found
//                   </Text>

//                   <Text
//                     style={[
//                       styles.emptyMemberText,
//                       {
//                         color: subTextColor,
//                       },
//                     ]}
//                   >
//                     Try another search term.
//                   </Text>
//                 </View>
//               }
//             />
//           </View>
//         </View>
//       </Modal>
//     </SafeAreaView>
//   );
// };

// export default AddTaskNonTimeBased;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//     zIndex: 10,
//   },

//   backBtn: {
//     padding: 8,
//     borderRadius: 8,
//     minWidth: 40,
//     minHeight: 40,
//     justifyContent: "center",
//     alignItems: "center",
//   },

//   headerBox: {
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 20,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   headerText: {
//     fontSize: 16,
//     fontWeight: "700",
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
//     width: "100%",
//     maxWidth: 600,
//     alignSelf: "center",
//   },

//   card: {
//     borderRadius: 14,
//     padding: 16,
//     marginBottom: 16,
//     borderWidth: 1,
//     elevation: 2,
//     shadowColor: "#000",
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.05,
//     shadowRadius: 4,
//   },

//   label: {
//     fontSize: 13,
//     fontWeight: "700",
//     textTransform: "uppercase",
//     letterSpacing: 0.6,
//     marginBottom: 10,
//   },

//   input: {
//     fontSize: 15,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     borderRadius: 10,
//     borderWidth: 1,
//     minHeight: 48,
//   },

//   descriptionInput: {
//     minHeight: 110,
//   },

//   radioContainer: {
//     flexDirection:
//       width < 360
//         ? "column"
//         : "row",
//     gap: 10,
//   },

//   radioItem: {
//     flex: 1,
//     flexDirection: "row",
//     alignItems: "center",
//     paddingVertical: 12,
//     paddingHorizontal: 12,
//     borderRadius: 10,
//     borderWidth: 1,
//     minHeight: 48,
//   },

//   radioOuter: {
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     borderWidth: 2,
//     marginRight: 10,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   radioInner: {
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//   },

//   radioText: {
//     fontSize: 14,
//   },

//   dateSelector: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     borderRadius: 10,
//     borderWidth: 1,
//     minHeight: 48,
//   },

//   dateInfoLeft: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },

//   dateText: {
//     fontSize: 14,
//     fontWeight: "600",
//   },

//   chooseDate: {
//     fontSize: 13,
//     fontWeight: "700",
//   },

//   mentionHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },

//   mentionTitleContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//   },

//   mentionLabel: {
//     marginBottom: 0,
//     marginLeft: 8,
//   },

//   mentionDescription: {
//     fontSize: 12,
//     lineHeight: 18,
//     marginTop: 8,
//     marginBottom: 12,
//   },

//   mentionSelector: {
//     minHeight: 68,
//     borderRadius: 12,
//     borderWidth: 1,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//   },

//   mentionSelectorLeft: {
//     flexDirection: "row",
//     alignItems: "center",
//     flex: 1,
//   },

//   mentionIconCircle: {
//     width: 42,
//     height: 42,
//     borderRadius: 21,
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 10,
//   },

//   mentionSelectorTextContainer: {
//     flex: 1,
//   },

//   mentionSelectorTitle: {
//     fontSize: 14,
//     fontWeight: "700",
//   },

//   mentionSelectorSubtitle: {
//     fontSize: 11,
//     marginTop: 3,
//   },

//   selectedMemberContainer: {
//     minHeight: 68,
//     borderRadius: 12,
//     borderWidth: 1,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     flexDirection: "row",
//     alignItems: "center",
//   },

//   selectedMemberAvatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 21,
//     backgroundColor: "#2563EB",
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 10,
//   },

//   selectedMemberInfo: {
//     flex: 1,
//   },

//   selectedMemberName: {
//     fontSize: 14,
//     fontWeight: "700",
//   },

//   selectedMemberPhone: {
//     fontSize: 11,
//     marginTop: 3,
//   },

//   removeMentionButton: {
//     padding: 5,
//   },

//   noMembersText: {
//     fontSize: 12,
//     marginTop: 10,
//     lineHeight: 18,
//   },

//   btnRow: {
//     flexDirection: "row",
//     gap: 12,
//     marginTop: 10,
//   },

//   btn: {
//     flex: 1,
//     paddingVertical: 14,
//     borderRadius: 12,
//     alignItems: "center",
//     justifyContent: "center",
//     minHeight: 50,
//   },

//   cancelBtn: {
//     backgroundColor: "transparent",
//     borderWidth: 1,
//   },

//   submitBtn: {
//     elevation: 3,
//     shadowColor: "#2563EB",
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
//     fontWeight: "700",
//     letterSpacing: 0.5,
//   },

//   submitBtnText: {
//     color: "#FFFFFF",
//     fontSize: 14,
//     fontWeight: "700",
//     letterSpacing: 0.5,
//   },

//   bottom: {
//     position: "absolute",
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 65,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     alignItems: "center",
//     borderTopWidth: 1,
//     elevation: 10,
//     shadowColor: "#000",
//     shadowOffset: {
//       width: 0,
//       height: -3,
//     },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//   },

//   iconBtn: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: 6,
//     minHeight: 48,
//   },

//   bottomNavText: {
//     color: "#FFFFFF",
//     fontSize: 10,
//     fontWeight: "600",
//     marginTop: 3,
//   },

//   modalOverlay: {
//     flex: 1,
//     justifyContent: "flex-end",
//   },

//   memberModal: {
//     width: "100%",
//     maxHeight: "82%",
//     borderTopLeftRadius: 24,
//     borderTopRightRadius: 24,
//     paddingHorizontal: 16,
//     paddingTop: 18,
//     paddingBottom: 24,
//   },

//   modalHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     marginBottom: 16,
//   },

//   modalTitle: {
//     fontSize: 20,
//     fontWeight: "800",
//   },

//   modalSubtitle: {
//     fontSize: 12,
//     marginTop: 3,
//   },

//   modalCloseButton: {
//     width: 38,
//     height: 38,
//     borderRadius: 19,
//     justifyContent: "center",
//     alignItems: "center",
//   },

//   searchContainer: {
//     height: 48,
//     borderRadius: 12,
//     borderWidth: 1,
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 12,
//     marginBottom: 12,
//   },

//   searchInput: {
//     flex: 1,
//     fontSize: 14,
//     marginLeft: 8,
//     paddingVertical: 0,
//   },

//   memberList: {
//     paddingBottom: 20,
//   },

//   memberItem: {
//     minHeight: 68,
//     borderRadius: 12,
//     borderWidth: 1,
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 12,
//     marginBottom: 9,
//   },

//   memberAvatar: {
//     width: 42,
//     height: 42,
//     borderRadius: 21,
//     backgroundColor: "#2563EB",
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 11,
//   },

//   memberItemInfo: {
//     flex: 1,
//   },

//   memberItemName: {
//     fontSize: 14,
//     fontWeight: "700",
//   },

//   memberItemPhone: {
//     fontSize: 11,
//     marginTop: 3,
//   },

//   emptyMemberList: {
//     flexGrow: 1,
//     justifyContent: "center",
//   },

//   emptyMemberContainer: {
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: 40,
//   },

//   emptyMemberTitle: {
//     fontSize: 15,
//     fontWeight: "700",
//     marginTop: 10,
//   },

//   emptyMemberText: {
//     fontSize: 12,
//     marginTop: 4,
//   },
// });







































// // import React, { useEffect, useState } from "react";
// // import {
// //   SafeAreaView,
// //   ScrollView,
// //   StyleSheet,
// //   Text,
// //   TextInput,
// //   TouchableOpacity,
// //   View,
// //   Alert,
// //   ActivityIndicator,
// //   Platform,
// //   StatusBar,
// //   Dimensions,
// //   Modal,
// //   FlatList,
// // } from "react-native";

// // import Icon from "@react-native-vector-icons/ionicons";
// // import AsyncStorage from "@react-native-async-storage/async-storage";
// // import DateTimePicker from "@react-native-community/datetimepicker";

// // import { useTheme } from "../../context/ThemeContext";
// // import { BASE_URL } from "../../config/api";

// // const { width } = Dimensions.get("window");

// // const goToLogin = (navigation) => {
// //   navigation.reset({
// //     index: 0,
// //     routes: [
// //       {
// //         name: "AuthStack",
// //         state: {
// //           routes: [{ name: "Login" }],
// //         },
// //       },
// //     ],
// //   });
// // };

// // const toDateOnlyString = (d) => {
// //   const year = d.getFullYear();
// //   const month = String(d.getMonth() + 1).padStart(2, "0");
// //   const day = String(d.getDate()).padStart(2, "0");

// //   return `${year}-${month}-${day}`;
// // };

// // const AddTaskNonTimeBased = ({ navigation, route }) => {
// //   const { theme } = useTheme();

// //   const [taskType, setTaskType] = useState("non");
// //   const [title, setTitle] = useState("");
// //   const [description, setDescription] = useState("");

// //   const [date, setDate] = useState(new Date());
// //   const [showDate, setShowDate] = useState(false);

// //   const [loading, setLoading] = useState(false);
// //   const [membersLoading, setMembersLoading] = useState(false);

// //   const [groupMembers, setGroupMembers] = useState([]);
// //   const [selectedMember, setSelectedMember] = useState(null);

// //   const [showMemberModal, setShowMemberModal] = useState(false);
// //   const [memberSearch, setMemberSearch] = useState("");

// //   const groupIdParam = route?.params?.groupId || null;

// //   const isGroupTask =
// //     groupIdParam !== null &&
// //     groupIdParam !== undefined &&
// //     String(groupIdParam).trim() !== "";

// //   const getToken = async () => {
// //     try {
// //       const token = await AsyncStorage.getItem("token");

// //       if (!token) {
// //         Alert.alert(
// //           "Session Expired",
// //           "Please login again.",
// //           [
// //             {
// //               text: "OK",
// //               onPress: () => goToLogin(navigation),
// //             },
// //           ]
// //         );

// //         return null;
// //       }

// //       return token;
// //     } catch (error) {
// //       console.log("Get Token Error:", error);
// //       return null;
// //     }
// //   };

// //   const apiFetch = async (endpoint, options = {}) => {
// //     const token = await getToken();

// //     if (!token) {
// //       throw new Error("Authentication required");
// //     }

// //     const response = await fetch(`${BASE_URL}${endpoint}`, {
// //       ...options,
// //       headers: {
// //         Accept: "application/json",
// //         "Content-Type": "application/json",
// //         Authorization: `Bearer ${token}`,
// //         ...(options.headers || {}),
// //       },
// //     });

// //     let data = null;

// //     try {
// //       const text = await response.text();

// //       if (text) {
// //         data = JSON.parse(text);
// //       }
// //     } catch (error) {
// //       console.log("Response JSON Parse Error:", error);
// //       data = null;
// //     }

// //     console.log(
// //       `API ${options.method || "GET"} ${endpoint}:`,
// //       response.status,
// //       data
// //     );

// //     if (response.status === 401) {
// //       await AsyncStorage.removeItem("token");

// //       Alert.alert(
// //         "Session Expired",
// //         "Please login again.",
// //         [
// //           {
// //             text: "OK",
// //             onPress: () => goToLogin(navigation),
// //           },
// //         ]
// //       );

// //       throw new Error("Session expired");
// //     }

// //     if (!response.ok) {
// //       throw new Error(
// //         data?.message ||
// //           data?.error ||
// //           `Request failed with status ${response.status}`
// //       );
// //     }

// //     return data;
// //   };

// //   const normalizeMember = (member, index) => {
// //     const userId =
// //       member?.userId ??
// //       member?.UserId ??
// //       member?.id ??
// //       member?.Id ??
// //       null;

// //     const name =
// //       member?.displayName ||
// //       member?.name ||
// //       member?.fullName ||
// //       member?.Name ||
// //       "Unknown Member";

// //     const phone =
// //       member?.phone ||
// //       member?.phoneNumber ||
// //       member?.Phone ||
// //       member?.PhoneNumber ||
// //       "";

// //     const isRegistered =
// //       member?.isRegistered !== undefined
// //         ? Boolean(member.isRegistered)
// //         : userId !== null && Number(userId) > 0;

// //     return {
// //       ...member,
// //       id: userId,
// //       userId: userId,
// //       name: String(name).trim() || "Unknown Member",
// //       phone: String(phone).trim(),
// //       isRegistered,
// //       uniqueKey: `${userId || "member"}-${index}`,
// //     };
// //   };

// //   const fetchGroupMembers = async () => {
// //     if (!isGroupTask) {
// //       setGroupMembers([]);
// //       return;
// //     }

// //     try {
// //       setMembersLoading(true);

// //       const response = await apiFetch("/Task/groups");

// //       console.log("Groups Response for Mention:", response);

// //       const groups = Array.isArray(response?.data)
// //         ? response.data
// //         : [];

// //       const selectedGroup = groups.find(
// //         (group) =>
// //           String(group?.id) === String(groupIdParam)
// //       );

// //       if (!selectedGroup) {
// //         console.log(
// //           "Selected group not found for mention:",
// //           groupIdParam
// //         );

// //         setGroupMembers([]);
// //         return;
// //       }

// //       const members = Array.isArray(selectedGroup?.members)
// //         ? selectedGroup.members
// //         : [];

// //       const normalizedMembers = members
// //         .map(normalizeMember)
// //         .filter(
// //           (member) =>
// //             member.isRegistered &&
// //             member.userId !== null &&
// //             Number(member.userId) > 0
// //         );

// //       setGroupMembers(normalizedMembers);

// //       console.log(
// //         "Group Members available for mention:",
// //         normalizedMembers
// //       );
// //     } catch (error) {
// //       console.log(
// //         "Fetch Group Members Error:",
// //         error
// //       );

// //       if (
// //         error?.message !== "Authentication required" &&
// //         error?.message !== "Session expired"
// //       ) {
// //         Alert.alert(
// //           "Error",
// //           error?.message ||
// //             "Failed to load group members."
// //         );
// //       }
// //     } finally {
// //       setMembersLoading(false);
// //     }
// //   };

// //   useEffect(() => {
// //     fetchGroupMembers();
// //   }, [groupIdParam]);

// //   const onChangeDate = (event, selectedDate) => {
// //     setShowDate(false);

// //     if (selectedDate) {
// //       setDate(selectedDate);
// //     }
// //   };

// //   const handleSelectMember = (member) => {
// //     if (!member?.userId) {
// //       Alert.alert(
// //         "Invalid Member",
// //         "This member cannot be mentioned because they do not have a registered user account."
// //       );
// //       return;
// //     }

// //     setSelectedMember(member);
// //     setShowMemberModal(false);
// //     setMemberSearch("");
// //   };

// //   const handleRemoveMention = () => {
// //     setSelectedMember(null);
// //   };

// //   const mentionUser = async (taskId) => {
// //     if (!taskId || !selectedMember?.userId) {
// //       return {
// //         success: true,
// //         skipped: true,
// //       };
// //     }

// //     try {
// //       const response = await apiFetch(
// //         `/Task/${taskId}/mention`,
// //         {
// //           method: "POST",
// //           body: JSON.stringify({
// //             MentionedUserId: Number(
// //               selectedMember.userId
// //             ),
// //           }),
// //         }
// //       );

// //       console.log(
// //         "Mention User Response:",
// //         response
// //       );

// //       if (response?.success === false) {
// //         throw new Error(
// //           response?.message ||
// //             "Failed to mention member."
// //         );
// //       }

// //       return {
// //         success: true,
// //         data: response?.data,
// //       };
// //     } catch (error) {
// //       console.log(
// //         "Mention User Error:",
// //         error
// //       );

// //       return {
// //         success: false,
// //         error,
// //       };
// //     }
// //   };

// //   const extractTaskId = (data) => {
// //     const possibleId =
// //       data?.data?.id ??
// //       data?.data?.taskId ??
// //       data?.taskId ??
// //       data?.id;

// //     if (
// //       possibleId !== undefined &&
// //       possibleId !== null &&
// //       Number(possibleId) > 0
// //     ) {
// //       return Number(possibleId);
// //     }

// //     return null;
// //   };

// //   const AddTask = async () => {
// //     if (!title.trim() || !description.trim()) {
// //       Alert.alert(
// //         "Error",
// //         "Please fill all fields."
// //       );
// //       return;
// //     }

// //     if (isGroupTask && membersLoading) {
// //       Alert.alert(
// //         "Please wait",
// //         "Group members are still loading."
// //       );
// //       return;
// //     }

// //     const token = await getToken();

// //     if (!token) {
// //       return;
// //     }

// //     try {
// //       setLoading(true);

// //       const requestBody = {
// //         title: title.trim(),
// //         description: description.trim(),
// //         dueDate: toDateOnlyString(date),
// //         isTimeBased: false,
// //         groupId: isGroupTask
// //           ? Number(groupIdParam)
// //           : null,
// //       };

// //       console.log(
// //         "Creating Task:",
// //         requestBody
// //       );

// //       const response = await fetch(
// //         `${BASE_URL}/Managment/task`,
// //         {
// //           method: "POST",
// //           headers: {
// //             "Content-Type": "application/json",
// //             Accept: "application/json",
// //             Authorization: `Bearer ${token}`,
// //           },
// //           body: JSON.stringify(requestBody),
// //         }
// //       );

// //       let data = null;

// //       try {
// //         const text = await response.text();

// //         if (text) {
// //           data = JSON.parse(text);
// //         }
// //       } catch (jsonError) {
// //         console.log(
// //           "Create Task JSON Error:",
// //           jsonError
// //         );
// //       }

// //       console.log(
// //         "Add Task Response:",
// //         response.status,
// //         data
// //       );

// //       if (!response.ok || data?.success === false) {
// //         throw new Error(
// //           data?.message ||
// //             `Failed to create task. Status: ${response.status}`
// //         );
// //       }

// //       const taskId = extractTaskId(data);

// //       console.log(
// //         "Created Task ID:",
// //         taskId
// //       );

// //       let mentionResult = null;

// //       if (
// //         isGroupTask &&
// //         selectedMember &&
// //         taskId
// //       ) {
// //         mentionResult = await mentionUser(taskId);
// //       }

// //       if (
// //         isGroupTask &&
// //         selectedMember &&
// //         !taskId
// //       ) {
// //         Alert.alert(
// //           "Task Created",
// //           "The task was created, but the server did not return the task ID, so the member could not be mentioned."
// //         );

// //         navigation.goBack();
// //         return;
// //       }

// //       if (
// //         mentionResult &&
// //         mentionResult.success === false
// //       ) {
// //         Alert.alert(
// //           "Task Created",
// //           `The task was created successfully, but ${selectedMember.name} could not be mentioned.\n\nReason: ${
// //             mentionResult.error?.message ||
// //             "Unknown error"
// //           }`,
// //           [
// //             {
// //               text: "OK",
// //               onPress: () => navigation.goBack(),
// //             },
// //           ]
// //         );

// //         return;
// //       }

// //       let successMessage =
// //         data?.message ||
// //         "Task created successfully.";

// //       if (
// //         selectedMember &&
// //         mentionResult?.success
// //       ) {
// //         successMessage += `\n\n${selectedMember.name} was mentioned successfully.`;
// //       }

// //       Alert.alert(
// //         "Success",
// //         successMessage,
// //         [
// //           {
// //             text: "OK",
// //             onPress: () =>
// //               navigation.goBack(),
// //           },
// //         ]
// //       );

// //       setTitle("");
// //       setDescription("");
// //       setDate(new Date());
// //       setSelectedMember(null);
// //     } catch (error) {
// //       console.log(
// //         "Add Task Error:",
// //         error
// //       );

// //       if (
// //         error?.message ===
// //         "Network request failed"
// //       ) {
// //         Alert.alert(
// //           "Connection Error",
// //           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
// //         );
// //       } else if (
// //         error?.message ===
// //         "Authentication required"
// //       ) {
// //         return;
// //       } else if (
// //         error?.message ===
// //         "Session expired"
// //       ) {
// //         return;
// //       } else {
// //         Alert.alert(
// //           "Error",
// //           error?.message ||
// //             "Server not reachable."
// //         );
// //       }
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const filteredMembers = groupMembers.filter(
// //     (member) => {
// //       const search = memberSearch
// //         .trim()
// //         .toLowerCase();

// //       if (!search) {
// //         return true;
// //       }

// //       return (
// //         member.name
// //           .toLowerCase()
// //           .includes(search) ||
// //         member.phone
// //           .toLowerCase()
// //           .includes(search)
// //       );
// //     }
// //   );

// //   const primaryColor =
// //     theme.primary || "#2563EB";

// //   const cardBg =
// //     theme.card || "#FFFFFF";

// //   const textColor =
// //     theme.text || "#0F172A";

// //   const subTextColor =
// //     theme.subText || "#64748B";

// //   const borderClr =
// //     theme.border || "#E2E8F0";

// //   const inputBg =
// //     theme.inputBg ||
// //     (theme.bg === "#000000" ||
// //     theme.bg === "#0F172A"
// //       ? "#1E293B"
// //       : "#F8FAFC");

// //   const isDark =
// //     theme.bg === "#000000" ||
// //     theme.bg === "#0F172A";

// //   return (
// //     <SafeAreaView
// //       style={[
// //         styles.container,
// //         {
// //           backgroundColor:
// //             theme.bg,
// //         },
// //       ]}
// //     >
// //       <StatusBar
// //         barStyle={
// //           isDark
// //             ? "light-content"
// //             : "dark-content"
// //         }
// //         backgroundColor={theme.bg}
// //       />

// //       <View
// //         style={[
// //           styles.header,
// //           {
// //             backgroundColor:
// //               theme.bg,
// //             borderBottomColor:
// //               borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           onPress={() =>
// //             navigation.goBack()
// //           }
// //           style={styles.backBtn}
// //           activeOpacity={0.7}
// //           accessibilityRole="button"
// //           accessibilityLabel="Go back"
// //         >
// //           <Icon
// //             name="arrow-back"
// //             size={24}
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
// //               {
// //                 color: textColor,
// //               },
// //             ]}
// //           >
// //             New Task
// //           </Text>
// //         </View>

// //         <View
// //           style={styles.headerSpacer}
// //         />
// //       </View>

// //       <ScrollView
// //         contentContainerStyle={
// //           styles.content
// //         }
// //         showsVerticalScrollIndicator={
// //           false
// //         }
// //         keyboardShouldPersistTaps="handled"
// //       >
// //         <View
// //           style={
// //             styles.responsiveWrapper
// //           }
// //         >
// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor:
// //                   cardBg,
// //                 borderColor:
// //                   borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 {
// //                   color: textColor,
// //                 },
// //               ]}
// //             >
// //               Task Title
// //             </Text>

// //             <TextInput
// //               placeholder="e.g. Design System Documentation"
// //               placeholderTextColor={
// //                 subTextColor
// //               }
// //               style={[
// //                 styles.input,
// //                 {
// //                   color: textColor,
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               value={title}
// //               onChangeText={setTitle}
// //               editable={!loading}
// //             />
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor:
// //                   cardBg,
// //                 borderColor:
// //                   borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 {
// //                   color: textColor,
// //                 },
// //               ]}
// //             >
// //               Description
// //             </Text>

// //             <TextInput
// //               placeholder="Provide context or instructions for this task..."
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
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               value={description}
// //               onChangeText={
// //                 setDescription
// //               }
// //               editable={!loading}
// //             />
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor:
// //                   cardBg,
// //                 borderColor:
// //                   borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 {
// //                   color: textColor,
// //                 },
// //               ]}
// //             >
// //               Task Mode
// //             </Text>

// //             <View
// //               style={
// //                 styles.radioContainer
// //               }
// //             >
// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setTaskType("time")
// //                 }
// //                 style={[
// //                   styles.radioItem,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       taskType === "time"
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //                 disabled={loading}
// //               >
// //                 <View
// //                   style={[
// //                     styles.radioOuter,
// //                     {
// //                       borderColor:
// //                         taskType === "time"
// //                           ? primaryColor
// //                           : subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   {taskType === "time" && (
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
// //                       color:
// //                         textColor,
// //                       fontWeight:
// //                         taskType ===
// //                         "time"
// //                           ? "700"
// //                           : "500",
// //                     },
// //                   ]}
// //                 >
// //                   Time Based
// //                 </Text>
// //               </TouchableOpacity>

// //               <TouchableOpacity
// //                 onPress={() =>
// //                   setTaskType("non")
// //                 }
// //                 style={[
// //                   styles.radioItem,
// //                   {
// //                     backgroundColor:
// //                       inputBg,
// //                     borderColor:
// //                       taskType === "non"
// //                         ? primaryColor
// //                         : borderClr,
// //                   },
// //                 ]}
// //                 activeOpacity={0.7}
// //                 disabled={loading}
// //               >
// //                 <View
// //                   style={[
// //                     styles.radioOuter,
// //                     {
// //                       borderColor:
// //                         taskType === "non"
// //                           ? primaryColor
// //                           : subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   {taskType === "non" && (
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
// //                       color:
// //                         textColor,
// //                       fontWeight:
// //                         taskType ===
// //                         "non"
// //                           ? "700"
// //                           : "500",
// //                     },
// //                   ]}
// //                 >
// //                   Non-Time Based
// //                 </Text>
// //               </TouchableOpacity>
// //             </View>

// //             {taskType === "time" && (
// //               <Text
// //                 style={[
// //                   styles.helperText,
// //                   {
// //                     color:
// //                       subTextColor,
// //                   },
// //                 ]}
// //               >
// //                 You are currently on the
// //                 Non-Time Based task screen.
// //                 Select Non-Time Based to
// //                 continue.
// //               </Text>
// //             )}
// //           </View>

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor:
// //                   cardBg,
// //                 borderColor:
// //                   borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 {
// //                   color: textColor,
// //                 },
// //               ]}
// //             >
// //               Due Date
// //             </Text>

// //             <TouchableOpacity
// //               style={[
// //                 styles.dateSelector,
// //                 {
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               onPress={() =>
// //                 setShowDate(true)
// //               }
// //               activeOpacity={0.7}
// //               disabled={loading}
// //             >
// //               <View
// //                 style={
// //                   styles.dateInfoLeft
// //                 }
// //               >
// //                 <Icon
// //                   name="calendar-outline"
// //                   size={20}
// //                   color={
// //                     primaryColor
// //                   }
// //                 />

// //                 <Text
// //                   style={[
// //                     styles.dateText,
// //                     {
// //                       color:
// //                         textColor,
// //                     },
// //                   ]}
// //                 >
// //                   {date.toDateString()}
// //                 </Text>
// //               </View>

// //               <Text
// //                 style={[
// //                   styles.chooseDate,
// //                   {
// //                     color:
// //                       primaryColor,
// //                   },
// //                 ]}
// //               >
// //                 Change Date
// //               </Text>
// //             </TouchableOpacity>
// //           </View>

// //           {showDate && (
// //             <DateTimePicker
// //               value={date}
// //               mode="date"
// //               display={
// //                 Platform.OS === "ios"
// //                   ? "spinner"
// //                   : "calendar"
// //               }
// //               onChange={
// //                 onChangeDate
// //               }
// //             />
// //           )}

// //           {isGroupTask && (
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
// //                     styles.mentionTitleContainer
// //                   }
// //                 >
// //                   <Icon
// //                     name="at-outline"
// //                     size={20}
// //                     color={
// //                       primaryColor
// //                     }
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.label,
// //                       styles.mentionLabel,
// //                       {
// //                         color:
// //                           textColor,
// //                       },
// //                     ]}
// //                   >
// //                     Mention Group Member
// //                   </Text>
// //                 </View>
// //               </View>

// //               <Text
// //                 style={[
// //                   styles.mentionDescription,
// //                   {
// //                     color:
// //                       subTextColor,
// //                   },
// //                 ]}
// //               >
// //                 Select a group member to
// //                 mention in this task. They
// //                 will receive a notification.
// //               </Text>

// //               {selectedMember ? (
// //                 <View
// //                   style={[
// //                     styles.selectedMemberContainer,
// //                     {
// //                       backgroundColor:
// //                         inputBg,
// //                       borderColor:
// //                         primaryColor,
// //                     },
// //                   ]}
// //                 >
// //                   <View
// //                     style={
// //                       styles.selectedMemberAvatar
// //                     }
// //                   >
// //                     <Icon
// //                       name="person"
// //                       size={20}
// //                       color="#FFFFFF"
// //                     />
// //                   </View>

// //                   <View
// //                     style={
// //                       styles.selectedMemberInfo
// //                     }
// //                   >
// //                     <Text
// //                       style={[
// //                         styles.selectedMemberName,
// //                         {
// //                           color:
// //                             textColor,
// //                         },
// //                       ]}
// //                       numberOfLines={1}
// //                     >
// //                       {selectedMember.name}
// //                     </Text>

// //                     {selectedMember.phone ? (
// //                       <Text
// //                         style={[
// //                           styles.selectedMemberPhone,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         {selectedMember.phone}
// //                       </Text>
// //                     ) : (
// //                       <Text
// //                         style={[
// //                           styles.selectedMemberPhone,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         Group member
// //                       </Text>
// //                     )}
// //                   </View>

// //                   <TouchableOpacity
// //                     style={
// //                       styles.removeMentionButton
// //                     }
// //                     onPress={
// //                       handleRemoveMention
// //                     }
// //                     disabled={
// //                       loading
// //                     }
// //                   >
// //                     <Icon
// //                       name="close-circle"
// //                       size={24}
// //                       color="#FF3B30"
// //                     />
// //                   </TouchableOpacity>
// //                 </View>
// //               ) : (
// //                 <TouchableOpacity
// //                   onPress={() => {
// //                     if (
// //                       membersLoading
// //                     ) {
// //                       return;
// //                     }

// //                     setShowMemberModal(
// //                       true
// //                     );
// //                   }}
// //                   style={[
// //                     styles.mentionSelector,
// //                     {
// //                       backgroundColor:
// //                         inputBg,
// //                       borderColor:
// //                         borderClr,
// //                     },
// //                   ]}
// //                   activeOpacity={0.7}
// //                   disabled={
// //                     membersLoading ||
// //                     loading
// //                   }
// //                 >
// //                   <View
// //                     style={
// //                       styles.mentionSelectorLeft
// //                     }
// //                   >
// //                     <View
// //                       style={[
// //                         styles.mentionIconCircle,
// //                         {
// //                           backgroundColor:
// //                             primaryColor,
// //                         },
// //                       ]}
// //                     >
// //                       <Icon
// //                         name="person-add"
// //                         size={18}
// //                         color="#FFFFFF"
// //                       />
// //                     </View>

// //                     <View
// //                       style={
// //                         styles.mentionSelectorTextContainer
// //                       }
// //                     >
// //                       <Text
// //                         style={[
// //                           styles.mentionSelectorTitle,
// //                           {
// //                             color:
// //                               textColor,
// //                           },
// //                         ]}
// //                       >
// //                         {membersLoading
// //                           ? "Loading members..."
// //                           : "Select a member"}
// //                       </Text>

// //                       <Text
// //                         style={[
// //                           styles.mentionSelectorSubtitle,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         {membersLoading
// //                           ? "Please wait"
// //                           : `${groupMembers.length} member${
// //                               groupMembers.length ===
// //                               1
// //                                 ? ""
// //                                 : "s"
// //                             } available`}
// //                       </Text>
// //                     </View>
// //                   </View>

// //                   {membersLoading ? (
// //                     <ActivityIndicator
// //                       size="small"
// //                       color={
// //                         primaryColor
// //                       }
// //                     />
// //                   ) : (
// //                     <Icon
// //                       name="chevron-forward"
// //                       size={20}
// //                       color={
// //                         subTextColor
// //                       }
// //                     />
// //                   )}
// //                 </TouchableOpacity>
// //               )}

// //               {groupMembers.length === 0 &&
// //                 !membersLoading && (
// //                   <Text
// //                     style={[
// //                       styles.noMembersText,
// //                       {
// //                         color:
// //                           subTextColor,
// //                       },
// //                     ]}
// //                   >
// //                     No registered group
// //                     members are available
// //                     to mention.
// //                   </Text>
// //                 )}
// //             </View>
// //           )}

// //           <View
// //             style={[
// //               styles.card,
// //               {
// //                 backgroundColor:
// //                   cardBg,
// //                 borderColor:
// //                   borderClr,
// //               },
// //             ]}
// //           >
// //             <Text
// //               style={[
// //                 styles.label,
// //                 {
// //                   color: textColor,
// //                 },
// //               ]}
// //             >
// //               Assign Task To
// //             </Text>

// //             <TouchableOpacity
// //               onPress={() =>
// //                 navigation.navigate(
// //                   "ForwardTaskTo"
// //                 )
// //               }
// //               style={[
// //                 styles.dropdown,
// //                 {
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //               activeOpacity={0.7}
// //               disabled={loading}
// //             >
// //               <Text
// //                 style={[
// //                   styles.dropdownText,
// //                   {
// //                     color:
// //                       textColor,
// //                   },
// //                 ]}
// //               >
// //                 Select Recipient / Group
// //               </Text>

// //               <Icon
// //                 name="chevron-down"
// //                 size={18}
// //                 color={
// //                   subTextColor
// //                 }
// //               />
// //             </TouchableOpacity>
// //           </View>

// //           <View
// //             style={styles.btnRow}
// //           >
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
// //                   {
// //                     color:
// //                       textColor,
// //                   },
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
// //               disabled={
// //                 loading ||
// //                 taskType !== "non"
// //               }
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
// //                 ? "#1E293B"
// //                 : "#0F172A"),
// //             borderTopColor:
// //               borderClr,
// //           },
// //         ]}
// //       >
// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               "HomeDashboard"
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="home"
// //             size={22}
// //             color="#FFFFFF"
// //           />

// //           <Text
// //             style={
// //               styles.bottomNavText
// //             }
// //           >
// //             Home
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               "AddMember"
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="person-add"
// //             size={22}
// //             color="#FFFFFF"
// //           />

// //           <Text
// //             style={
// //               styles.bottomNavText
// //             }
// //           >
// //             Members
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               "TimeBasedHistoryScreen"
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="time"
// //             size={22}
// //             color="#FFFFFF"
// //           />

// //           <Text
// //             style={
// //               styles.bottomNavText
// //             }
// //           >
// //             History
// //           </Text>
// //         </TouchableOpacity>

// //         <TouchableOpacity
// //           style={styles.iconBtn}
// //           onPress={() =>
// //             navigation.navigate(
// //               "SettingScreen"
// //             )
// //           }
// //           activeOpacity={0.7}
// //         >
// //           <Icon
// //             name="settings"
// //             size={22}
// //             color="#FFFFFF"
// //           />

// //           <Text
// //             style={
// //               styles.bottomNavText
// //             }
// //           >
// //             Settings
// //           </Text>
// //         </TouchableOpacity>
// //       </View>

// //       <Modal
// //         visible={showMemberModal}
// //         transparent
// //         animationType="slide"
// //         onRequestClose={() =>
// //           setShowMemberModal(false)
// //         }
// //       >
// //         <View
// //           style={[
// //             styles.modalOverlay,
// //             {
// //               backgroundColor:
// //                 "rgba(0,0,0,0.55)",
// //             },
// //           ]}
// //         >
// //           <View
// //             style={[
// //               styles.memberModal,
// //               {
// //                 backgroundColor:
// //                   cardBg,
// //               },
// //             ]}
// //           >
// //             <View
// //               style={
// //                 styles.modalHeader
// //               }
// //             >
// //               <View>
// //                 <Text
// //                   style={[
// //                     styles.modalTitle,
// //                     {
// //                       color:
// //                         textColor,
// //                     },
// //                   ]}
// //                 >
// //                   Mention Member
// //                 </Text>

// //                 <Text
// //                   style={[
// //                     styles.modalSubtitle,
// //                     {
// //                       color:
// //                         subTextColor,
// //                     },
// //                   ]}
// //                 >
// //                   Select a group member
// //                 </Text>
// //               </View>

// //               <TouchableOpacity
// //                 onPress={() => {
// //                   setShowMemberModal(
// //                     false
// //                   );
// //                   setMemberSearch("");
// //                 }}
// //                 style={
// //                   styles.modalCloseButton
// //                 }
// //               >
// //                 <Icon
// //                   name="close"
// //                   size={24}
// //                   color={
// //                     textColor
// //                   }
// //                 />
// //               </TouchableOpacity>
// //             </View>

// //             <View
// //               style={[
// //                 styles.searchContainer,
// //                 {
// //                   backgroundColor:
// //                     inputBg,
// //                   borderColor:
// //                     borderClr,
// //                 },
// //               ]}
// //             >
// //               <Icon
// //                 name="search"
// //                 size={19}
// //                 color={
// //                   subTextColor
// //                 }
// //               />

// //               <TextInput
// //                 style={[
// //                   styles.searchInput,
// //                   {
// //                     color:
// //                       textColor,
// //                   },
// //                 ]}
// //                 placeholder="Search member..."
// //                 placeholderTextColor={
// //                   subTextColor
// //                 }
// //                 value={memberSearch}
// //                 onChangeText={
// //                   setMemberSearch
// //                 }
// //                 autoCorrect={false}
// //               />

// //               {memberSearch.length >
// //                 0 && (
// //                 <TouchableOpacity
// //                   onPress={() =>
// //                     setMemberSearch(
// //                       ""
// //                     )
// //                   }
// //                 >
// //                   <Icon
// //                     name="close-circle"
// //                     size={19}
// //                     color={
// //                       subTextColor
// //                     }
// //                   />
// //                 </TouchableOpacity>
// //               )}
// //             </View>

// //             <FlatList
// //               data={
// //                 filteredMembers
// //               }
// //               keyExtractor={(
// //                 item,
// //                 index
// //               ) =>
// //                 String(
// //                   item.uniqueKey ||
// //                     `${item.userId}-${index}`
// //                 )
// //               }
// //               keyboardShouldPersistTaps="handled"
// //               showsVerticalScrollIndicator={
// //                 false
// //               }
// //               contentContainerStyle={
// //                 filteredMembers.length ===
// //                 0
// //                   ? styles.emptyMemberList
// //                   : styles.memberList
// //               }
// //               renderItem={({
// //                 item,
// //               }) => (
// //                 <TouchableOpacity
// //                   style={[
// //                     styles.memberItem,
// //                     {
// //                       backgroundColor:
// //                         inputBg,
// //                       borderColor:
// //                         borderClr,
// //                     },
// //                   ]}
// //                   onPress={() =>
// //                     handleSelectMember(
// //                       item
// //                     )
// //                   }
// //                   activeOpacity={
// //                     0.7
// //                 }
// //                 >
// //                   <View
// //                     style={
// //                       styles.memberAvatar
// //                     }
// //                   >
// //                     <Icon
// //                       name="person"
// //                       size={20}
// //                       color="#FFFFFF"
// //                     />
// //                   </View>

// //                   <View
// //                     style={
// //                       styles.memberItemInfo
// //                     }
// //                   >
// //                     <Text
// //                       style={[
// //                         styles.memberItemName,
// //                         {
// //                           color:
// //                             textColor,
// //                         },
// //                       ]}
// //                       numberOfLines={1}
// //                     >
// //                       {item.name}
// //                     </Text>

// //                     {item.phone ? (
// //                       <Text
// //                         style={[
// //                           styles.memberItemPhone,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         {item.phone}
// //                       </Text>
// //                     ) : (
// //                       <Text
// //                         style={[
// //                           styles.memberItemPhone,
// //                           {
// //                             color:
// //                               subTextColor,
// //                           },
// //                         ]}
// //                       >
// //                         Registered group member
// //                       </Text>
// //                     )}
// //                   </View>

// //                   <Icon
// //                     name="at"
// //                     size={22}
// //                     color={
// //                       primaryColor
// //                     }
// //                   />
// //                 </TouchableOpacity>
// //               )}
// //               ListEmptyComponent={
// //                 <View
// //                   style={
// //                     styles.emptyMemberContainer
// //                   }
// //                 >
// //                   <Icon
// //                     name="people-outline"
// //                     size={42}
// //                     color={
// //                       subTextColor
// //                     }
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.emptyMemberTitle,
// //                       {
// //                         color:
// //                           textColor,
// //                       },
// //                     ]}
// //                   >
// //                     No members found
// //                   </Text>

// //                   <Text
// //                     style={[
// //                       styles.emptyMemberText,
// //                       {
// //                         color:
// //                           subTextColor,
// //                       },
// //                     ]}
// //                   >
// //                     Try another search
// //                     term.
// //                   </Text>
// //                 </View>
// //               }
// //             />
// //           </View>
// //         </View>
// //       </Modal>
// //     </SafeAreaView>
// //   );
// // };

// // export default AddTaskNonTimeBased;

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //   },

// //   header: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //     paddingHorizontal: 16,
// //     paddingVertical: 12,
// //     borderBottomWidth: 1,
// //     zIndex: 10,
// //   },

// //   backBtn: {
// //     padding: 8,
// //     borderRadius: 8,
// //     minWidth: 40,
// //     minHeight: 40,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },

// //   headerBox: {
// //     paddingHorizontal: 16,
// //     paddingVertical: 8,
// //     borderRadius: 20,
// //     alignItems: "center",
// //     justifyContent: "center",
// //   },

// //   headerText: {
// //     fontSize: 16,
// //     fontWeight: "700",
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
// //     width: "100%",
// //     maxWidth: 600,
// //     alignSelf: "center",
// //   },

// //   card: {
// //     borderRadius: 14,
// //     padding: 16,
// //     marginBottom: 16,
// //     borderWidth: 1,
// //     elevation: 2,
// //     shadowColor: "#000",
// //     shadowOffset: {
// //       width: 0,
// //       height: 2,
// //     },
// //     shadowOpacity: 0.05,
// //     shadowRadius: 4,
// //   },

// //   label: {
// //     fontSize: 13,
// //     fontWeight: "700",
// //     textTransform: "uppercase",
// //     letterSpacing: 0.6,
// //     marginBottom: 10,
// //   },

// //   input: {
// //     fontSize: 15,
// //     paddingHorizontal: 14,
// //     paddingVertical: 12,
// //     borderRadius: 10,
// //     borderWidth: 1,
// //     minHeight: 48,
// //   },

// //   descriptionInput: {
// //     minHeight: 110,
// //   },

// //   radioContainer: {
// //     flexDirection:
// //       width < 360
// //         ? "column"
// //         : "row",
// //     gap: 10,
// //   },

// //   radioItem: {
// //     flex: 1,
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingVertical: 12,
// //     paddingHorizontal: 12,
// //     borderRadius: 10,
// //     borderWidth: 1,
// //     minHeight: 48,
// //   },

// //   radioOuter: {
// //     width: 20,
// //     height: 20,
// //     borderRadius: 10,
// //     borderWidth: 2,
// //     marginRight: 10,
// //     alignItems: "center",
// //     justifyContent: "center",
// //   },

// //   radioInner: {
// //     width: 10,
// //     height: 10,
// //     borderRadius: 5,
// //   },

// //   radioText: {
// //     fontSize: 14,
// //   },

// //   helperText: {
// //     fontSize: 12,
// //     marginTop: 10,
// //     lineHeight: 18,
// //   },

// //   dateSelector: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //     paddingHorizontal: 14,
// //     paddingVertical: 12,
// //     borderRadius: 10,
// //     borderWidth: 1,
// //     minHeight: 48,
// //   },

// //   dateInfoLeft: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     gap: 10,
// //   },

// //   dateText: {
// //     fontSize: 14,
// //     fontWeight: "600",
// //   },

// //   chooseDate: {
// //     fontSize: 13,
// //     fontWeight: "700",
// //   },

// //   dropdown: {
// //     borderRadius: 10,
// //     paddingHorizontal: 14,
// //     paddingVertical: 12,
// //     borderWidth: 1,
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     alignItems: "center",
// //     minHeight: 48,
// //   },

// //   dropdownText: {
// //     fontSize: 14,
// //     fontWeight: "500",
// //   },

// //   mentionHeader: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //   },

// //   mentionTitleContainer: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //   },

// //   mentionLabel: {
// //     marginBottom: 0,
// //     marginLeft: 8,
// //   },

// //   mentionDescription: {
// //     fontSize: 12,
// //     lineHeight: 18,
// //     marginTop: 8,
// //     marginBottom: 12,
// //   },

// //   mentionSelector: {
// //     minHeight: 68,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     paddingHorizontal: 12,
// //     paddingVertical: 10,
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //   },

// //   mentionSelectorLeft: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     flex: 1,
// //   },

// //   mentionIconCircle: {
// //     width: 42,
// //     height: 42,
// //     borderRadius: 21,
// //     justifyContent: "center",
// //     alignItems: "center",
// //     marginRight: 10,
// //   },

// //   mentionSelectorTextContainer: {
// //     flex: 1,
// //   },

// //   mentionSelectorTitle: {
// //     fontSize: 14,
// //     fontWeight: "700",
// //   },

// //   mentionSelectorSubtitle: {
// //     fontSize: 11,
// //     marginTop: 3,
// //   },

// //   selectedMemberContainer: {
// //     minHeight: 68,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     paddingHorizontal: 10,
// //     paddingVertical: 8,
// //     flexDirection: "row",
// //     alignItems: "center",
// //   },

// //   selectedMemberAvatar: {
// //     width: 42,
// //     height: 42,
// //     borderRadius: 21,
// //     backgroundColor: "#2563EB",
// //     justifyContent: "center",
// //     alignItems: "center",
// //     marginRight: 10,
// //   },

// //   selectedMemberInfo: {
// //     flex: 1,
// //   },

// //   selectedMemberName: {
// //     fontSize: 14,
// //     fontWeight: "700",
// //   },

// //   selectedMemberPhone: {
// //     fontSize: 11,
// //     marginTop: 3,
// //   },

// //   removeMentionButton: {
// //     padding: 5,
// //   },

// //   noMembersText: {
// //     fontSize: 12,
// //     marginTop: 10,
// //     lineHeight: 18,
// //   },

// //   btnRow: {
// //     flexDirection: "row",
// //     gap: 12,
// //     marginTop: 10,
// //   },

// //   btn: {
// //     flex: 1,
// //     paddingVertical: 14,
// //     borderRadius: 12,
// //     alignItems: "center",
// //     justifyContent: "center",
// //     minHeight: 50,
// //   },

// //   cancelBtn: {
// //     backgroundColor: "transparent",
// //     borderWidth: 1,
// //   },

// //   submitBtn: {
// //     elevation: 3,
// //     shadowColor: "#2563EB",
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
// //     fontWeight: "700",
// //     letterSpacing: 0.5,
// //   },

// //   submitBtnText: {
// //     color: "#FFFFFF",
// //     fontSize: 14,
// //     fontWeight: "700",
// //     letterSpacing: 0.5,
// //   },

// //   bottom: {
// //     position: "absolute",
// //     bottom: 0,
// //     left: 0,
// //     right: 0,
// //     height: 65,
// //     flexDirection: "row",
// //     justifyContent: "space-around",
// //     alignItems: "center",
// //     borderTopWidth: 1,
// //     elevation: 10,
// //     shadowColor: "#000",
// //     shadowOffset: {
// //       width: 0,
// //       height: -3,
// //     },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 4,
// //   },

// //   iconBtn: {
// //     flex: 1,
// //     alignItems: "center",
// //     justifyContent: "center",
// //     paddingVertical: 6,
// //     minHeight: 48,
// //   },

// //   bottomNavText: {
// //     color: "#FFFFFF",
// //     fontSize: 10,
// //     fontWeight: "600",
// //     marginTop: 3,
// //   },

// //   modalOverlay: {
// //     flex: 1,
// //     justifyContent: "flex-end",
// //   },

// //   memberModal: {
// //     width: "100%",
// //     maxHeight: "82%",
// //     borderTopLeftRadius: 24,
// //     borderTopRightRadius: 24,
// //     paddingHorizontal: 16,
// //     paddingTop: 18,
// //     paddingBottom: 24,
// //   },

// //   modalHeader: {
// //     flexDirection: "row",
// //     alignItems: "center",
// //     justifyContent: "space-between",
// //     marginBottom: 16,
// //   },

// //   modalTitle: {
// //     fontSize: 20,
// //     fontWeight: "800",
// //   },

// //   modalSubtitle: {
// //     fontSize: 12,
// //     marginTop: 3,
// //   },

// //   modalCloseButton: {
// //     width: 38,
// //     height: 38,
// //     borderRadius: 19,
// //     justifyContent: "center",
// //     alignItems: "center",
// //   },

// //   searchContainer: {
// //     height: 48,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingHorizontal: 12,
// //     marginBottom: 12,
// //   },

// //   searchInput: {
// //     flex: 1,
// //     fontSize: 14,
// //     marginLeft: 8,
// //     paddingVertical: 0,
// //   },

// //   memberList: {
// //     paddingBottom: 20,
// //   },

// //   memberItem: {
// //     minHeight: 68,
// //     borderRadius: 12,
// //     borderWidth: 1,
// //     flexDirection: "row",
// //     alignItems: "center",
// //     paddingHorizontal: 12,
// //     marginBottom: 9,
// //   },

// //   memberAvatar: {
// //     width: 42,
// //     height: 42,
// //     borderRadius: 21,
// //     backgroundColor: "#2563EB",
// //     justifyContent: "center",
// //     alignItems: "center",
// //     marginRight: 11,
// //   },

// //   memberItemInfo: {
// //     flex: 1,
// //   },

// //   memberItemName: {
// //     fontSize: 14,
// //     fontWeight: "700",
// //   },

// //   memberItemPhone: {
// //     fontSize: 11,
// //     marginTop: 3,
// //   },

// //   emptyMemberList: {
// //     flexGrow: 1,
// //     justifyContent: "center",
// //   },

// //   emptyMemberContainer: {
// //     alignItems: "center",
// //     justifyContent: "center",
// //     paddingVertical: 40,
// //   },

// //   emptyMemberTitle: {
// //     fontSize: 15,
// //     fontWeight: "700",
// //     marginTop: 10,
// //   },

// //   emptyMemberText: {
// //     fontSize: 12,
// //     marginTop: 4,
// //   },
// // });


































// // // import React, { useState } from "react";
// // // import {
// // //   SafeAreaView,
// // //   ScrollView,
// // //   StyleSheet,
// // //   Text,
// // //   TextInput,
// // //   TouchableOpacity,
// // //   View,
// // //   Alert,
// // //   ActivityIndicator,
// // //   Platform,
// // //   StatusBar,
// // //   Dimensions,
// // // } from "react-native";
// // // import Icon from "@react-native-vector-icons/ionicons";
// // // import AsyncStorage from "@react-native-async-storage/async-storage";
// // // import DateTimePicker from "@react-native-community/datetimepicker";

// // // import { useTheme } from "../../context/ThemeContext";
// // // import { BASE_URL } from "../../config/api";

// // // const { width } = Dimensions.get("window");

// // // // Helper: reset navigation to the Login screen inside AuthStack.
// // // const goToLogin = (navigation) => {
// // //   navigation.reset({
// // //     index: 0,
// // //     routes: [
// // //       {
// // //         name: "AuthStack",
// // //         state: {
// // //           routes: [{ name: "Login" }],
// // //         },
// // //       },
// // //     ],
// // //   });
// // // };

// // // // Format a JS Date as "yyyy-MM-dd" to match backend DateOnly format
// // // const toDateOnlyString = (d) => {
// // //   const year = d.getFullYear();
// // //   const month = String(d.getMonth() + 1).padStart(2, "0");
// // //   const day = String(d.getDate()).padStart(2, "0");
// // //   return `${year}-${month}-${day}`;
// // // };

// // // const AddTaskNonTimeBased = ({ navigation, route }) => {
// // //   const { theme } = useTheme();

// // //   const [taskType, setTaskType] = useState("non");
// // //   const [title, setTitle] = useState("");
// // //   const [description, setDescription] = useState("");

// // //   const [date, setDate] = useState(new Date());
// // //   const [showDate, setShowDate] = useState(false);

// // //   const [loading, setLoading] = useState(false);

// // //   const groupIdParam = route?.params?.groupId || null;

// // //   // HANDLE DATE
// // //   const onChangeDate = (event, selectedDate) => {
// // //     setShowDate(false);
// // //     if (selectedDate) {
// // //       setDate(selectedDate);
// // //     }
// // //   };

// // //   // ADD TASK
// // //   const AddTask = async () => {
// // //     if (!title.trim() || !description.trim()) {
// // //       Alert.alert("Error", "Please fill all fields");
// // //       return;
// // //     }

// // //     const token = await AsyncStorage.getItem("token");

// // //     if (!token) {
// // //       Alert.alert("Session Expired", "Please login again.", [
// // //         {
// // //           text: "OK",
// // //           onPress: () => goToLogin(navigation),
// // //         },
// // //       ]);
// // //       return;
// // //     }

// // //     try {
// // //       setLoading(true);

// // //       const response = await fetch(`${BASE_URL}/Managment/task`, {
// // //         method: "POST",
// // //         headers: {
// // //           "Content-Type": "application/json",
// // //           Accept: "application/json",
// // //           Authorization: `Bearer ${token}`,
// // //         },
// // //         body: JSON.stringify({
// // //           title: title.trim(),
// // //           description: description.trim(),
// // //           dueDate: toDateOnlyString(date),
// // //           isTimeBased: false,
// // //           groupId: groupIdParam,
// // //         }),
// // //       });

// // //       let data;
// // //       try {
// // //         data = await response.json();
// // //       } catch (jsonError) {
// // //         throw new Error("Invalid response received from server.");
// // //       }

// // //       console.log("Add Task Response:", data);

// // //       if (response.ok && data?.success) {
// // //         Alert.alert(
// // //           "Success",
// // //           data.message || "Task created successfully.",
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
// // //         Alert.alert("Error", data?.message || "Failed to create task.");
// // //       }
// // //     } catch (error) {
// // //       console.log("Add Task Error:", error);

// // //       if (error?.message === "Network request failed") {
// // //         Alert.alert(
// // //           "Connection Error",
// // //           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
// // //         );
// // //       } else {
// // //         Alert.alert("Error", error?.message || "Server not reachable.");
// // //       }
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   // Color Palette standardizing with context themes safely
// // //   const primaryColor = theme.primary || "#2563EB";
// // //   const cardBg = theme.card || "#FFFFFF";
// // //   const textColor = theme.text || "#0F172A";
// // //   const subTextColor = theme.subText || "#64748B";
// // //   const borderClr = theme.border || "#E2E8F0";
// // //   const inputBg = theme.inputBg || (theme.bg === "#000000" || theme.bg === "#0F172A" ? "#1E293B" : "#F8FAFC");

// // //   return (
// // //     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
// // //       <StatusBar
// // //         barStyle={theme.bg === "#000000" || theme.bg === "#0F172A" ? "light-content" : "dark-content"}
// // //         backgroundColor={theme.bg}
// // //       />

// // //       {/* FIXED HEADER */}
// // //       <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: borderClr }]}>
// // //         <TouchableOpacity
// // //           onPress={() => navigation.goBack()}
// // //           style={styles.backBtn}
// // //           activeOpacity={0.7}
// // //           accessibilityRole="button"
// // //           accessibilityLabel="Go back"
// // //         >
// // //           <Icon name="arrow-back" size={24} color={textColor} />
// // //         </TouchableOpacity>

// // //         <View style={[styles.headerBox, { backgroundColor: theme.headerBox || inputBg }]}>
// // //           <Text style={[styles.headerText, { color: textColor }]}>New Task</Text>
// // //         </View>

// // //         <View style={styles.headerSpacer} />
// // //       </View>

// // //       <ScrollView
// // //         contentContainerStyle={styles.content}
// // //         showsVerticalScrollIndicator={false}
// // //         keyboardShouldPersistTaps="handled"
// // //       >
// // //         <View style={styles.responsiveWrapper}>
// // //           {/* TITLE INPUT CARD */}
// // //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// // //             <Text style={[styles.label, { color: textColor }]}>Task Title</Text>
// // //             <TextInput
// // //               placeholder="e.g. Design System Documentation"
// // //               placeholderTextColor={subTextColor}
// // //               style={[styles.input, { color: textColor, backgroundColor: inputBg, borderColor: borderClr }]}
// // //               value={title}
// // //               onChangeText={setTitle}
// // //             />
// // //           </View>

// // //           {/* DESCRIPTION INPUT CARD */}
// // //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// // //             <Text style={[styles.label, { color: textColor }]}>Description</Text>
// // //             <TextInput
// // //               placeholder="Provide context or instructions for this task..."
// // //               placeholderTextColor={subTextColor}
// // //               multiline
// // //               numberOfLines={4}
// // //               textAlignVertical="top"
// // //               style={[
// // //                 styles.input,
// // //                 styles.descriptionInput,
// // //                 { color: textColor, backgroundColor: inputBg, borderColor: borderClr },
// // //               ]}
// // //               value={description}
// // //               onChangeText={setDescription}
// // //             />
// // //           </View>

// // //           {/* TASK TYPE SELECTOR */}
// // //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// // //             <Text style={[styles.label, { color: textColor }]}>Task Mode</Text>
// // //             <View style={styles.radioContainer}>
// // //               <TouchableOpacity
// // //                 onPress={() => setTaskType("time")}
// // //                 style={[
// // //                   styles.radioItem,
// // //                   { backgroundColor: inputBg, borderColor: taskType === "time" ? primaryColor : borderClr },
// // //                 ]}
// // //                 activeOpacity={0.7}
// // //               >
// // //                 <View style={[styles.radioOuter, { borderColor: taskType === "time" ? primaryColor : subTextColor }]}>
// // //                   {taskType === "time" && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
// // //                 </View>
// // //                 <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === "time" ? "700" : "500" }]}>
// // //                   Time Based
// // //                 </Text>
// // //               </TouchableOpacity>

// // //               <TouchableOpacity
// // //                 onPress={() => setTaskType("non")}
// // //                 style={[
// // //                   styles.radioItem,
// // //                   { backgroundColor: inputBg, borderColor: taskType === "non" ? primaryColor : borderClr },
// // //                 ]}
// // //                 activeOpacity={0.7}
// // //               >
// // //                 <View style={[styles.radioOuter, { borderColor: taskType === "non" ? primaryColor : subTextColor }]}>
// // //                   {taskType === "non" && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
// // //                 </View>
// // //                 <Text style={[styles.radioText, { color: textColor, fontWeight: taskType === "non" ? "700" : "500" }]}>
// // //                   Non-Time Based
// // //                 </Text>
// // //               </TouchableOpacity>
// // //             </View>
// // //           </View>

// // //           {/* DUE DATE CARD */}
// // //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// // //             <Text style={[styles.label, { color: textColor }]}>Due Date</Text>
// // //             <TouchableOpacity
// // //               style={[styles.dateSelector, { backgroundColor: inputBg, borderColor: borderClr }]}
// // //               onPress={() => setShowDate(true)}
// // //               activeOpacity={0.7}
// // //             >
// // //               <View style={styles.dateInfoLeft}>
// // //                 <Icon name="calendar-outline" size={20} color={primaryColor} />
// // //                 <Text style={[styles.dateText, { color: textColor }]}>{date.toDateString()}</Text>
// // //               </View>
// // //               <Text style={[styles.chooseDate, { color: primaryColor }]}>Change Date</Text>
// // //             </TouchableOpacity>
// // //           </View>

// // //           {/* DATE PICKER COMPONENT */}
// // //           {showDate && (
// // //             <DateTimePicker
// // //               value={date}
// // //               mode="date"
// // //               display={Platform.OS === "ios" ? "spinner" : "calendar"}
// // //               onChange={onChangeDate}
// // //             />
// // //           )}

// // //           {/* ASSIGNMENT DROPDOWN */}
// // //           <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderClr }]}>
// // //             <Text style={[styles.label, { color: textColor }]}>Assign Task To</Text>
// // //             <TouchableOpacity
// // //               onPress={() => navigation.navigate("ForwardTaskTo")}
// // //               style={[styles.dropdown, { backgroundColor: inputBg, borderColor: borderClr }]}
// // //               activeOpacity={0.7}
// // //             >
// // //               <Text style={[styles.dropdownText, { color: textColor }]}>Select Recipient / Group</Text>
// // //               <Icon name="chevron-down" size={18} color={subTextColor} />
// // //             </TouchableOpacity>
// // //           </View>

// // //           {/* ACTION BUTTONS */}
// // //           <View style={styles.btnRow}>
// // //             <TouchableOpacity
// // //               style={[styles.btn, styles.cancelBtn, { borderColor: borderClr }]}
// // //               onPress={() => navigation.goBack()}
// // //               disabled={loading}
// // //               activeOpacity={0.7}
// // //             >
// // //               <Text style={[styles.btnText, { color: textColor }]}>CANCEL</Text>
// // //             </TouchableOpacity>

// // //             <TouchableOpacity
// // //               style={[styles.btn, styles.submitBtn, { backgroundColor: primaryColor }, loading && styles.btnDisabled]}
// // //               onPress={AddTask}
// // //               disabled={loading}
// // //               activeOpacity={0.8}
// // //             >
// // //               {loading ? (
// // //                 <ActivityIndicator color="#FFFFFF" size="small" />
// // //               ) : (
// // //                 <Text style={styles.submitBtnText}>ADD TASK</Text>
// // //               )}
// // //             </TouchableOpacity>
// // //           </View>
// // //         </View>
// // //       </ScrollView>

// // //       {/* BOTTOM NAVIGATION BAR */}
// // //       <View
// // //         style={[
// // //           styles.bottom,
// // //           {
// // //             backgroundColor: theme.bottomNav || (theme.bg === "#000000" || theme.bg === "#0F172A" ? "#1E293B" : "#0F172A"),
// // //             borderTopColor: borderClr,
// // //           },
// // //         ]}
// // //       >
// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() => navigation.navigate("HomeDashboard")}
// // //           activeOpacity={0.7}
// // //         >
// // //           <Icon name="home" size={22} color="#FFFFFF" />
// // //           <Text style={styles.bottomNavText}>Home</Text>
// // //         </TouchableOpacity>

// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() => navigation.navigate("AddMember")}
// // //           activeOpacity={0.7}
// // //         >
// // //           <Icon name="person-add" size={22} color="#FFFFFF" />
// // //           <Text style={styles.bottomNavText}>Members</Text>
// // //         </TouchableOpacity>

// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() => navigation.navigate("TimeBasedHistoryScreen")}
// // //           activeOpacity={0.7}
// // //         >
// // //           <Icon name="time" size={22} color="#FFFFFF" />
// // //           <Text style={styles.bottomNavText}>History</Text>
// // //         </TouchableOpacity>

// // //         <TouchableOpacity
// // //           style={styles.iconBtn}
// // //           onPress={() => navigation.navigate("SettingScreen")}
// // //           activeOpacity={0.7}
// // //         >
// // //           <Icon name="settings" size={22} color="#FFFFFF" />
// // //           <Text style={styles.bottomNavText}>Settings</Text>
// // //         </TouchableOpacity>
// // //       </View>
// // //     </SafeAreaView>
// // //   );
// // // };

// // // export default AddTaskNonTimeBased;

// // // const styles = StyleSheet.create({
// // //   container: {
// // //     flex: 1,
// // //     paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
// // //   },

// // //   /* HEADER STYLES */
// // //   header: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     justifyContent: "space-between",
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 12,
// // //     borderBottomWidth: 1,
// // //     zIndex: 10,
// // //   },

// // //   backBtn: {
// // //     padding: 8,
// // //     borderRadius: 8,
// // //     minWidth: 40,
// // //     minHeight: 40,
// // //     justifyContent: "center",
// // //     alignItems: "center",
// // //   },

// // //   headerBox: {
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 8,
// // //     borderRadius: 20,
// // //     alignItems: "center",
// // //     justifyContent: "center",
// // //   },

// // //   headerText: {
// // //     fontSize: 16,
// // //     fontWeight: "700",
// // //     letterSpacing: 0.3,
// // //   },

// // //   headerSpacer: {
// // //     width: 40,
// // //   },

// // //   /* LAYOUT & CONTENT */
// // //   content: {
// // //     paddingHorizontal: 16,
// // //     paddingTop: 16,
// // //     paddingBottom: 100, // Safe clearance for bottom navigation
// // //   },

// // //   responsiveWrapper: {
// // //     width: "100%",
// // //     maxWidth: 600,
// // //     alignSelf: "center",
// // //   },

// // //   /* CARD STYLES */
// // //   card: {
// // //     borderRadius: 14,
// // //     padding: 16,
// // //     marginBottom: 16,
// // //     borderWidth: 1,
// // //     // Soft shadow for depth
// // //     elevation: 2,
// // //     shadowColor: "#000",
// // //     shadowOffset: { width: 0, height: 2 },
// // //     shadowOpacity: 0.05,
// // //     shadowRadius: 4,
// // //   },

// // //   label: {
// // //     fontSize: 13,
// // //     fontWeight: "700",
// // //     textTransform: "uppercase",
// // //     letterSpacing: 0.6,
// // //     marginBottom: 10,
// // //   },

// // //   /* INPUT STYLES */
// // //   input: {
// // //     fontSize: 15,
// // //     paddingHorizontal: 14,
// // //     paddingVertical: 12,
// // //     borderRadius: 10,
// // //     borderWidth: 1,
// // //     minHeight: 48,
// // //   },

// // //   descriptionInput: {
// // //     minHeight: 110,
// // //   },

// // //   /* RADIO STYLES */
// // //   radioContainer: {
// // //     flexDirection: width < 360 ? "column" : "row",
// // //     gap: 10,
// // //   },

// // //   radioItem: {
// // //     flex: 1,
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     paddingVertical: 12,
// // //     paddingHorizontal: 12,
// // //     borderRadius: 10,
// // //     borderWidth: 1,
// // //     minHeight: 48,
// // //   },

// // //   radioOuter: {
// // //     width: 20,
// // //     height: 20,
// // //     borderRadius: 10,
// // //     borderWidth: 2,
// // //     marginRight: 10,
// // //     alignItems: "center",
// // //     justifyContent: "center",
// // //   },

// // //   radioInner: {
// // //     width: 10,
// // //     height: 10,
// // //     borderRadius: 5,
// // //   },

// // //   radioText: {
// // //     fontSize: 14,
// // //   },

// // //   /* DATE STYLES */
// // //   dateSelector: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     justifyContent: "space-between",
// // //     paddingHorizontal: 14,
// // //     paddingVertical: 12,
// // //     borderRadius: 10,
// // //     borderWidth: 1,
// // //     minHeight: 48,
// // //   },

// // //   dateInfoLeft: {
// // //     flexDirection: "row",
// // //     alignItems: "center",
// // //     gap: 10,
// // //   },

// // //   dateText: {
// // //     fontSize: 14,
// // //     fontWeight: "600",
// // //   },

// // //   chooseDate: {
// // //     fontSize: 13,
// // //     fontWeight: "700",
// // //   },

// // //   /* DROPDOWN STYLES */
// // //   dropdown: {
// // //     borderRadius: 10,
// // //     paddingHorizontal: 14,
// // //     paddingVertical: 12,
// // //     borderWidth: 1,
// // //     flexDirection: "row",
// // //     justifyContent: "space-between",
// // //     alignItems: "center",
// // //     minHeight: 48,
// // //   },

// // //   dropdownText: {
// // //     fontSize: 14,
// // //     fontWeight: "500",
// // //   },

// // //   /* ACTION BUTTONS */
// // //   btnRow: {
// // //     flexDirection: "row",
// // //     gap: 12,
// // //     marginTop: 10,
// // //   },

// // //   btn: {
// // //     flex: 1,
// // //     paddingVertical: 14,
// // //     borderRadius: 12,
// // //     alignItems: "center",
// // //     justifyContent: "center",
// // //     minHeight: 50,
// // //   },

// // //   cancelBtn: {
// // //     backgroundColor: "transparent",
// // //     borderWidth: 1,
// // //   },

// // //   submitBtn: {
// // //     elevation: 3,
// // //     shadowColor: "#2563EB",
// // //     shadowOffset: { width: 0, height: 3 },
// // //     shadowOpacity: 0.3,
// // //     shadowRadius: 5,
// // //   },

// // //   btnDisabled: {
// // //     opacity: 0.6,
// // //   },

// // //   btnText: {
// // //     fontSize: 14,
// // //     fontWeight: "700",
// // //     letterSpacing: 0.5,
// // //   },

// // //   submitBtnText: {
// // //     color: "#FFFFFF",
// // //     fontSize: 14,
// // //     fontWeight: "700",
// // //     letterSpacing: 0.5,
// // //   },

// // //   /* BOTTOM NAVIGATION BAR */
// // //   bottom: {
// // //     position: "absolute",
// // //     bottom: 0,
// // //     left: 0,
// // //     right: 0,
// // //     height: 65,
// // //     flexDirection: "row",
// // //     justifyContent: "space-around",
// // //     alignItems: "center",
// // //     borderTopWidth: 1,
// // //     elevation: 10,
// // //     shadowColor: "#000",
// // //     shadowOffset: { width: 0, height: -3 },
// // //     shadowOpacity: 0.1,
// // //     shadowRadius: 4,
// // //   },

// // //   iconBtn: {
// // //     flex: 1,
// // //     alignItems: "center",
// // //     justifyContent: "center",
// // //     paddingVertical: 6,
// // //     minHeight: 48,
// // //   },

// // //   bottomNavText: {
// // //     color: "#FFFFFF",
// // //     fontSize: 10,
// // //     fontWeight: "600",
// // //     marginTop: 3,
// // //   },
// // // });
















































// // // // import React, { useState } from "react";
// // // // import {
// // // //   SafeAreaView,
// // // //   ScrollView,
// // // //   StyleSheet,
// // // //   Text,
// // // //   TextInput,
// // // //   TouchableOpacity,
// // // //   View,
// // // //   Alert,
// // // //   ActivityIndicator,
// // // // } from "react-native";
// // // // import Icon from '@react-native-vector-icons/ionicons';
// // // // import AsyncStorage from "@react-native-async-storage/async-storage";
// // // // import DateTimePicker from "@react-native-community/datetimepicker";

// // // // import { useTheme } from "../../context/ThemeContext";
// // // // import { BASE_URL } from "../../config/api";

// // // // // ============================================================
// // // // // Helper: reset navigation to the Login screen inside AuthStack.
// // // // // 'Login' is NOT a screen in the root navigator (only 'AuthStack'
// // // // // and 'MainStack' are), so navigation.replace('Login') from
// // // // // anywhere inside MainStack throws:
// // // // //   "The action 'REPLACE' with payload {"name":"Login"} was not
// // // // //    handled by any navigator."
// // // // // ============================================================
// // // // const goToLogin = navigation => {
// // // //   navigation.reset({
// // // //     index: 0,
// // // //     routes: [
// // // //       {
// // // //         name: "AuthStack",
// // // //         state: {
// // // //           routes: [{ name: "Login" }],
// // // //         },
// // // //       },
// // // //     ],
// // // //   });
// // // // };

// // // // // Format a JS Date as "yyyy-MM-dd" to match the backend's
// // // // // DateOnly binding for CreateTaskDto.DueDate. Sending a full
// // // // // ISO timestamp (date.toISOString()) does not reliably bind
// // // // // to DateOnly and can fail or produce the wrong date.
// // // // const toDateOnlyString = d => {
// // // //   const year = d.getFullYear();
// // // //   const month = String(d.getMonth() + 1).padStart(2, "0");
// // // //   const day = String(d.getDate()).padStart(2, "0");
// // // //   return `${year}-${month}-${day}`;
// // // // };

// // // // const AddTaskNonTimeBased = ({ navigation, route }) => {
// // // //   const { theme } = useTheme();

// // // //   const [taskType, setTaskType] = useState("non");
// // // //   const [title, setTitle] = useState("");
// // // //   const [description, setDescription] = useState("");

// // // //   const [date, setDate] = useState(new Date());
// // // //   const [showDate, setShowDate] = useState(false);

// // // //   const [loading, setLoading] = useState(false);

// // // //   const groupIdParam = route?.params?.groupId || null;

// // // //   // ==========================================
// // // //   // HANDLE DATE
// // // //   // ==========================================
// // // //   const onChangeDate = (event, selectedDate) => {
// // // //     setShowDate(false);

// // // //     if (selectedDate) {
// // // //       setDate(selectedDate);
// // // //     }
// // // //   };

// // // //   // ==========================================
// // // //   // ADD TASK
// // // //   // ==========================================
// // // //   const AddTask = async () => {
// // // //     if (!title.trim() || !description.trim()) {
// // // //       Alert.alert(
// // // //         "Error",
// // // //         "Please fill all fields"
// // // //       );
// // // //       return;
// // // //     }

// // // //     // Check authentication
// // // //     const token =
// // // //       await AsyncStorage.getItem("token");

// // // //     if (!token) {
// // // //       Alert.alert(
// // // //         "Session Expired",
// // // //         "Please login again.",
// // // //         [
// // // //           {
// // // //             text: "OK",
// // // //             onPress: () => goToLogin(navigation),
// // // //           },
// // // //         ]
// // // //       );

// // // //       return;
// // // //     }

// // // //     try {
// // // //       setLoading(true);

// // // //       // NOTE: correct route is "api/Managment/task"
// // // //       // (ManagmentController.CreateTask), not "api/tasks"
// // // //       // which does not exist on the backend.
// // // //       const response = await fetch(
// // // //         `${BASE_URL}/Managment/task`,
// // // //         {
// // // //           method: "POST",
// // // //           headers: {
// // // //             "Content-Type": "application/json",
// // // //             Accept: "application/json",
// // // //             Authorization: `Bearer ${token}`,
// // // //           },
// // // //           body: JSON.stringify({
// // // //             title: title.trim(),
// // // //             description: description.trim(),
// // // //             // NOTE: backend expects a DateOnly ("yyyy-MM-dd"),
// // // //             // not a full ISO timestamp.
// // // //             dueDate: toDateOnlyString(date),
// // // //             isTimeBased: false,
// // // //             groupId: groupIdParam,
// // // //           }),
// // // //         }
// // // //       );

// // // //       let data;

// // // //       try {
// // // //         data = await response.json();
// // // //       } catch (jsonError) {
// // // //         throw new Error(
// // // //           "Invalid response received from server."
// // // //         );
// // // //       }

// // // //       console.log(
// // // //         "Add Task Response:",
// // // //         data
// // // //       );

// // // //       if (response.ok && data?.success) {
// // // //         Alert.alert(
// // // //           "Success",
// // // //           data.message ||
// // // //             "Task created successfully.",
// // // //           [
// // // //             {
// // // //               text: "OK",
// // // //               onPress: () =>
// // // //                 navigation.goBack(),
// // // //             },
// // // //           ]
// // // //         );

// // // //         setTitle("");
// // // //         setDescription("");
// // // //         setDate(new Date());
// // // //       } else {
// // // //         Alert.alert(
// // // //           "Error",
// // // //           data?.message ||
// // // //             "Failed to create task."
// // // //         );
// // // //       }
// // // //     } catch (error) {
// // // //       console.log(
// // // //         "Add Task Error:",
// // // //         error
// // // //       );

// // // //       if (
// // // //         error?.message ===
// // // //         "Network request failed"
// // // //       ) {
// // // //         Alert.alert(
// // // //           "Connection Error",
// // // //           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
// // // //         );
// // // //       } else {
// // // //         Alert.alert(
// // // //           "Error",
// // // //           error?.message ||
// // // //             "Server not reachable."
// // // //         );
// // // //       }
// // // //     } finally {
// // // //       setLoading(false);
// // // //     }
// // // //   };

// // // //   return (
// // // //     <SafeAreaView
// // // //       style={[
// // // //         styles.container,
// // // //         {
// // // //           backgroundColor: theme.bg,
// // // //         },
// // // //       ]}
// // // //     >
// // // //       <ScrollView
// // // //         contentContainerStyle={styles.content}
// // // //         showsVerticalScrollIndicator={false}
// // // //         keyboardShouldPersistTaps="handled"
// // // //       >
// // // //         {/* HEADER */}
// // // //         <View style={styles.header}>
// // // //           <TouchableOpacity
// // // //             onPress={() =>
// // // //               navigation.goBack()
// // // //             }
// // // //           >
// // // //             <Icon
// // // //               name="arrow-back"
// // // //               size={22}
// // // //               color={theme.text}
// // // //             />
// // // //           </TouchableOpacity>

// // // //           <View
// // // //             style={[
// // // //               styles.headerBox,
// // // //               {
// // // //                 backgroundColor:
// // // //                   theme.headerBox,
// // // //               },
// // // //             ]}
// // // //           >
// // // //             <Text
// // // //               style={[
// // // //                 styles.headerText,
// // // //                 {
// // // //                   color: theme.text,
// // // //                 },
// // // //               ]}
// // // //             >
// // // //               ADD-TASK
// // // //             </Text>
// // // //           </View>

// // // //           <View style={{ width: 22 }} />
// // // //         </View>

// // // //         {/* TITLE */}
// // // //         <View
// // // //           style={[
// // // //             styles.card,
// // // //             {
// // // //               backgroundColor:
// // // //                 theme.card,
// // // //             },
// // // //           ]}
// // // //         >
// // // //           <Text
// // // //             style={[
// // // //               styles.label,
// // // //               {
// // // //                 color: theme.text,
// // // //               },
// // // //             ]}
// // // //           >
// // // //             TITLE:
// // // //           </Text>

// // // //           <TextInput
// // // //             placeholder="TITLE"
// // // //             placeholderTextColor="#888"
// // // //             style={[
// // // //               styles.input,
// // // //               {
// // // //                 color: theme.text,
// // // //               },
// // // //             ]}
// // // //             value={title}
// // // //             onChangeText={setTitle}
// // // //           />
// // // //         </View>

// // // //         {/* DESCRIPTION */}
// // // //         <View
// // // //           style={[
// // // //             styles.card,
// // // //             styles.descriptionCard,
// // // //             {
// // // //               backgroundColor:
// // // //                 theme.card,
// // // //             },
// // // //           ]}
// // // //         >
// // // //           <Text
// // // //             style={[
// // // //               styles.label,
// // // //               {
// // // //                 color: theme.text,
// // // //               },
// // // //             ]}
// // // //           >
// // // //             DESCRIPTION
// // // //           </Text>

// // // //           <TextInput
// // // //             placeholder="DESCRIPTION"
// // // //             placeholderTextColor="#888"
// // // //             multiline
// // // //             textAlignVertical="top"
// // // //             style={[
// // // //               styles.input,
// // // //               styles.descriptionInput,
// // // //               {
// // // //                 color: theme.text,
// // // //               },
// // // //             ]}
// // // //             value={description}
// // // //             onChangeText={setDescription}
// // // //           />
// // // //         </View>

// // // //         {/* TYPE */}
// // // //         <Text
// // // //           style={[
// // // //             styles.section,
// // // //             {
// // // //               color: theme.text,
// // // //             },
// // // //           ]}
// // // //         >
// // // //           TIME BASED & NON TIME BASED:
// // // //         </Text>

// // // //         <View style={styles.radioRow}>
// // // //           {/* TIME BASED */}
// // // //           <TouchableOpacity
// // // //             onPress={() =>
// // // //               setTaskType("time")
// // // //             }
// // // //             style={styles.radioItem}
// // // //           >
// // // //             <View style={styles.radioOuter}>
// // // //               {taskType === "time" && (
// // // //                 <View
// // // //                   style={styles.radioInner}
// // // //                 />
// // // //               )}
// // // //             </View>

// // // //             <Text
// // // //               style={{
// // // //                 color: theme.text,
// // // //               }}
// // // //             >
// // // //               TIME BASED
// // // //             </Text>
// // // //           </TouchableOpacity>

// // // //           {/* NON-TIME BASED */}
// // // //           <TouchableOpacity
// // // //             onPress={() =>
// // // //               setTaskType("non")
// // // //             }
// // // //             style={styles.radioItem}
// // // //           >
// // // //             <View style={styles.radioOuter}>
// // // //               {taskType === "non" && (
// // // //                 <View
// // // //                   style={styles.radioInner}
// // // //                 />
// // // //               )}
// // // //             </View>

// // // //             <Text
// // // //               style={{
// // // //                 color: theme.text,
// // // //               }}
// // // //             >
// // // //               NON-TIME BASED
// // // //             </Text>
// // // //           </TouchableOpacity>
// // // //         </View>

// // // //         {/* DATE */}
// // // //         <Text
// // // //           style={[
// // // //             styles.section,
// // // //             {
// // // //               color: theme.text,
// // // //             },
// // // //           ]}
// // // //         >
// // // //           DATE
// // // //         </Text>

// // // //         <View style={styles.dateCard}>
// // // //           <Text
// // // //             style={[
// // // //               styles.dateTitle,
// // // //               {
// // // //                 color: theme.text,
// // // //               },
// // // //             ]}
// // // //           >
// // // //             DUE DATE:
// // // //           </Text>

// // // //           <View style={styles.dateRow}>
// // // //             <View style={styles.chip}>
// // // //               <Text
// // // //                 style={[
// // // //                   styles.chipText,
// // // //                   {
// // // //                     color: theme.text,
// // // //                   },
// // // //                 ]}
// // // //               >
// // // //                 {date.toDateString()}
// // // //               </Text>
// // // //             </View>

// // // //             <TouchableOpacity
// // // //               onPress={() =>
// // // //                 setShowDate(true)
// // // //               }
// // // //             >
// // // //               <Icon
// // // //                 name="calendar-outline"
// // // //                 size={22}
// // // //                 color={theme.text}
// // // //               />
// // // //             </TouchableOpacity>

// // // //             <TouchableOpacity
// // // //               onPress={() =>
// // // //                 setShowDate(true)
// // // //               }
// // // //             >
// // // //               <Text
// // // //                 style={[
// // // //                   styles.chooseDate,
// // // //                   {
// // // //                     color: theme.text,
// // // //                   },
// // // //                 ]}
// // // //               >
// // // //                 choose date
// // // //               </Text>
// // // //             </TouchableOpacity>
// // // //           </View>
// // // //         </View>

// // // //         {/* DATE PICKER */}
// // // //         {showDate && (
// // // //           <DateTimePicker
// // // //             value={date}
// // // //             mode="date"
// // // //             display="calendar"
// // // //             onChange={onChangeDate}
// // // //           />
// // // //         )}

// // // //         {/* ADD TASK FOR */}
// // // //         <Text
// // // //           style={[
// // // //             styles.section,
// // // //             {
// // // //               color: theme.text,
// // // //             },
// // // //           ]}
// // // //         >
// // // //           ADD TASK FOR
// // // //         </Text>

// // // //         <TouchableOpacity
// // // //           onPress={() =>
// // // //             navigation.navigate(
// // // //               "ForwardTaskTo"
// // // //             )
// // // //           }
// // // //           style={styles.dropdown}
// // // //         >
// // // //           <Text
// // // //             style={[
// // // //               styles.dropdownText,
// // // //               {
// // // //                 color: theme.text,
// // // //               },
// // // //             ]}
// // // //           >
// // // //             ADD TASK FOR
// // // //           </Text>

// // // //           <Icon
// // // //             name="chevron-down"
// // // //             size={18}
// // // //             color={theme.text}
// // // //           />
// // // //         </TouchableOpacity>

// // // //         {/* BUTTONS */}
// // // //         <View style={styles.btnRow}>
// // // //           <TouchableOpacity
// // // //             style={styles.btn}
// // // //             onPress={() =>
// // // //               navigation.goBack()
// // // //             }
// // // //             disabled={loading}
// // // //           >
// // // //             <Text style={styles.btnText}>
// // // //               CANCEL
// // // //             </Text>
// // // //           </TouchableOpacity>

// // // //           <TouchableOpacity
// // // //             style={[
// // // //               styles.btn,
// // // //               loading && styles.btnDisabled,
// // // //             ]}
// // // //             onPress={AddTask}
// // // //             disabled={loading}
// // // //           >
// // // //             {loading ? (
// // // //               <ActivityIndicator color="#fff" />
// // // //             ) : (
// // // //               <Text style={styles.btnText}>
// // // //                 ADD
// // // //               </Text>
// // // //             )}
// // // //           </TouchableOpacity>
// // // //         </View>
// // // //       </ScrollView>

// // // //       {/* BOTTOM NAV */}
// // // //       <View
// // // //         style={[
// // // //           styles.bottom,
// // // //           {
// // // //             backgroundColor:
// // // //               theme.bottomNav,
// // // //           },
// // // //         ]}
// // // //       >
// // // //         <TouchableOpacity
// // // //           style={styles.iconBtn}
// // // //           onPress={() =>
// // // //             navigation.navigate(
// // // //               "HomeDashboard"
// // // //             )
// // // //           }
// // // //         >
// // // //           <Icon
// // // //             name="home"
// // // //             size={24}
// // // //             color="#fff"
// // // //           />
// // // //         </TouchableOpacity>

// // // //         <TouchableOpacity
// // // //           style={styles.iconBtn}
// // // //           onPress={() =>
// // // //             navigation.navigate(
// // // //               "AddMember"
// // // //             )
// // // //           }
// // // //         >
// // // //           <Icon
// // // //             name="person-add"
// // // //             size={24}
// // // //             color="#fff"
// // // //           />
// // // //         </TouchableOpacity>

// // // //         <TouchableOpacity
// // // //           style={styles.iconBtn}
// // // //           onPress={() =>
// // // //             navigation.navigate(
// // // //               "TimeBasedHistoryScreen"
// // // //             )
// // // //           }
// // // //         >
// // // //           <Icon
// // // //             name="time"
// // // //             size={24}
// // // //             color="#fff"
// // // //           />
// // // //         </TouchableOpacity>

// // // //         <TouchableOpacity
// // // //           style={styles.iconBtn}
// // // //           onPress={() =>
// // // //             navigation.navigate(
// // // //               "SettingScreen"
// // // //             )
// // // //           }
// // // //         >
// // // //           <Icon
// // // //             name="settings"
// // // //             size={24}
// // // //             color="#fff"
// // // //           />
// // // //         </TouchableOpacity>
// // // //       </View>
// // // //     </SafeAreaView>
// // // //   );
// // // // };

// // // // export default AddTaskNonTimeBased;

// // // // const styles = StyleSheet.create({
// // // //   container: {
// // // //     flex: 1,
// // // //   },

// // // //   content: {
// // // //     padding: 20,
// // // //     paddingBottom: 120,
// // // //   },

// // // //   header: {
// // // //     flexDirection: "row",
// // // //     justifyContent: "space-between",
// // // //     alignItems: "center",
// // // //   },

// // // //   headerBox: {
// // // //     paddingHorizontal: 20,
// // // //     paddingVertical: 6,
// // // //     borderRadius: 10,
// // // //   },

// // // //   headerText: {
// // // //     fontWeight: "800",
// // // //   },

// // // //   card: {
// // // //     borderRadius: 12,
// // // //     padding: 14,
// // // //     marginTop: 18,
// // // //   },

// // // //   descriptionCard: {
// // // //     height: 120,
// // // //   },

// // // //   label: {
// // // //     fontWeight: "800",
// // // //   },

// // // //   input: {
// // // //     fontSize: 12,
// // // //     paddingVertical: 8,
// // // //   },

// // // //   descriptionInput: {
// // // //     flex: 1,
// // // //   },

// // // //   section: {
// // // //     marginTop: 20,
// // // //     fontWeight: "800",
// // // //   },

// // // //   radioRow: {
// // // //     flexDirection: "row",
// // // //     marginTop: 10,
// // // //   },

// // // //   radioItem: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     marginRight: 25,
// // // //   },

// // // //   radioOuter: {
// // // //     width: 18,
// // // //     height: 18,
// // // //     borderRadius: 9,
// // // //     borderWidth: 2,
// // // //     marginRight: 6,
// // // //     alignItems: "center",
// // // //     justifyContent: "center",
// // // //   },

// // // //   radioInner: {
// // // //     width: 8,
// // // //     height: 8,
// // // //     backgroundColor: "#000",
// // // //     borderRadius: 4,
// // // //   },

// // // //   dateCard: {
// // // //     marginTop: 10,
// // // //     backgroundColor: "#EDEDED",
// // // //     borderRadius: 12,
// // // //     padding: 14,
// // // //   },

// // // //   dateTitle: {
// // // //     fontWeight: "800",
// // // //     marginBottom: 10,
// // // //   },

// // // //   dateRow: {
// // // //     flexDirection: "row",
// // // //     alignItems: "center",
// // // //     gap: 10,
// // // //   },

// // // //   chip: {
// // // //     backgroundColor: "#BDBDBD",
// // // //     borderRadius: 6,
// // // //     paddingHorizontal: 10,
// // // //     paddingVertical: 6,
// // // //   },

// // // //   chipText: {
// // // //     fontWeight: "600",
// // // //   },

// // // //   chooseDate: {
// // // //     textDecorationLine: "underline",
// // // //   },

// // // //   dropdown: {
// // // //     marginTop: 12,
// // // //     backgroundColor: "#EDEDED",
// // // //     borderRadius: 25,
// // // //     padding: 14,
// // // //     flexDirection: "row",
// // // //     justifyContent: "space-between",
// // // //   },

// // // //   dropdownText: {
// // // //     fontSize: 14,
// // // //   },

// // // //   btnRow: {
// // // //     flexDirection: "row",
// // // //     justifyContent: "space-between",
// // // //     marginTop: 30,
// // // //   },

// // // //   btn: {
// // // //     width: "45%",
// // // //     backgroundColor: "#000",
// // // //     padding: 14,
// // // //     borderRadius: 30,
// // // //     alignItems: "center",
// // // //   },

// // // //   btnDisabled: {
// // // //     backgroundColor: "#777",
// // // //   },

// // // //   btnText: {
// // // //     color: "#fff",
// // // //     fontWeight: "800",
// // // //   },

// // // //   bottom: {
// // // //     position: "absolute",
// // // //     bottom: 0,
// // // //     width: "100%",
// // // //     height: 65,
// // // //     flexDirection: "row",
// // // //     justifyContent: "space-around",
// // // //     alignItems: "center",
// // // //   },

// // // //   iconBtn: {
// // // //     flex: 1,
// // // //     alignItems: "center",
// // // //   },
// // // // });

