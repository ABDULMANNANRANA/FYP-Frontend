import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  RefreshControl,
} from "react-native";

import Icon from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const GroupDashboard = ({ navigation, route }) => {
  const { theme } = useTheme();

  const groupId =
    route?.params?.groupId ??
    route?.params?.id ??
    route?.params?.group?.id ??
    null;

  const routeGroupName =
    route?.params?.groupName ||
    route?.params?.name ||
    route?.params?.group?.name ||
    "GROUP";

  const [groupName, setGroupName] = useState(
    String(routeGroupName).toUpperCase()
  );

  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getToken = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Session Expired",
          "Please login again.",
          [
            {
              text: "OK",
              onPress: () => goToLogin(navigation),
            },
          ]
        );

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

    const response = await fetch(
      `${BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      }
    );

    let data = null;

    try {
      const text = await response.text();

      if (text) {
        data = JSON.parse(text);
      }
    } catch (error) {
      console.log(
        "Response JSON Parse Error:",
        error
      );
    }

    console.log(
      `API ${options.method || "GET"} ${endpoint}:`,
      response.status,
      data
    );

    if (response.status === 401) {
      await AsyncStorage.removeItem("token");

      Alert.alert(
        "Session Expired",
        "Please login again.",
        [
          {
            text: "OK",
            onPress: () => goToLogin(navigation),
          },
        ]
      );

      throw new Error("Session expired");
    }

    if (response.status === 403) {
      throw new Error(
        "You are not a member of this group."
      );
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
      member?.name ||
      member?.displayName ||
      member?.fullName ||
      member?.Name ||
      "Unknown Member";

    const phone =
      member?.phone ||
      member?.phoneNumber ||
      member?.Phone ||
      member?.PhoneNumber ||
      "";

    return {
      ...member,

      id: member?.id ?? member?.Id ?? index,

      userId,

      name:
        String(name).trim() ||
        "Unknown Member",

      phone:
        String(phone).trim(),

      role:
        member?.role ||
        member?.Role ||
        "Member",

      isRegistered:
        member?.isRegistered ??
        member?.IsRegistered ??
        userId !== null,

      uniqueKey:
        `${userId || "external"}-${index}`,
    };
  };

  const normalizeTask = (task, index) => {
    const rawStatus =
      task?.status ??
      task?.Status ??
      "Pending";

    const status =
      String(rawStatus).trim() || "Pending";

    return {
      ...task,

      id:
        task?.id ??
        task?.Id ??
        task?.taskId ??
        task?.TaskId ??
        index,

      title:
        task?.title ||
        task?.Title ||
        "Untitled Task",

      description:
        task?.description ||
        task?.Description ||
        "",

      status,

      dueDate:
        task?.dueDate ??
        task?.DueDate ??
        null,

      dueTime:
        task?.dueTime ??
        task?.DueTime ??
        null,

      isTimeBased:
        task?.isTimeBased ??
        task?.IsTimeBased ??
        false,

      groupId:
        task?.groupId ??
        task?.GroupId ??
        groupId,

      createdBy:
        task?.createdBy ??
        task?.CreatedBy ??
        null,

      createdByName:
        task?.createdByName ||
        task?.CreatedByName ||
        "",

      assignedTo:
        task?.assignedTo ??
        task?.AssignedTo ??
        null,

      assignedToName:
        task?.assignedToName ||
        task?.AssignedToName ||
        "",

      mentions:
        Array.isArray(task?.mentions)
          ? task.mentions
          : Array.isArray(task?.Mentions)
          ? task.Mentions
          : [],

      latitude:
        task?.latitude ??
        task?.Latitude ??
        null,

      longitude:
        task?.longitude ??
        task?.Longitude ??
        null,

      geofenceEnabled:
        task?.geofenceEnabled ??
        task?.GeofenceEnabled ??
        false,

      geofenceRadiusMeters:
        task?.geofenceRadiusMeters ??
        task?.GeofenceRadiusMeters ??
        200,
    };
  };

  const fetchGroupData = useCallback(
    async (showLoader = true) => {
      if (
        groupId === null ||
        groupId === undefined ||
        String(groupId).trim() === ""
      ) {
        setLoading(false);

        Alert.alert(
          "Group Error",
          "Group ID was not provided."
        );

        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        const response = await apiFetch(
          `/Task/group/${encodeURIComponent(
            groupId
          )}/dashboard`
        );

        console.log(
          "GROUP DASHBOARD API RESPONSE:",
          response
        );

        const responseGroupId =
          response?.groupId ??
          response?.GroupId ??
          groupId;

        const responseGroupName =
          response?.groupName ||
          response?.GroupName ||
          routeGroupName;

        const responseMembers =
          Array.isArray(response?.members)
            ? response.members
            : Array.isArray(response?.Members)
            ? response.Members
            : [];

        const responseTasks =
          Array.isArray(response?.tasks)
            ? response.tasks
            : Array.isArray(response?.Tasks)
            ? response.Tasks
            : [];

        console.log(
          "GROUP ID:",
          responseGroupId
        );

        console.log(
          "GROUP NAME:",
          responseGroupName
        );

        console.log(
          "GROUP MEMBERS:",
          responseMembers
        );

        console.log(
          "GROUP TASKS:",
          responseTasks
        );

        setGroupName(
          String(
            responseGroupName
          ).toUpperCase()
        );

        setMembers(
          responseMembers.map(
            normalizeMember
          )
        );

        setTasks(
          responseTasks.map(
            normalizeTask
          )
        );
      } catch (error) {
        console.log(
          "Fetch Group Dashboard Error:",
          error
        );

        if (
          error?.message !==
            "Authentication required" &&
          error?.message !==
            "Session expired"
        ) {
          Alert.alert(
            "Error",
            error?.message ||
              "Failed to load group dashboard."
          );
        }

        setTasks([]);
      } finally {
        setLoading(false);
      }
    },
    [
      groupId,
      routeGroupName,
      navigation,
    ]
  );

  useEffect(() => {
    fetchGroupData(true);
  }, [fetchGroupData]);

  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        "focus",
        () => {
          fetchGroupData(false);
        }
      );

    return unsubscribe;
  }, [
    navigation,
    fetchGroupData,
  ]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      await fetchGroupData(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddTimeTask = () => {
    navigation.navigate(
      "AddTaskTimeBased",
      {
        groupId: Number(groupId),
        groupName,
      }
    );
  };

  const handleAddNonTimeTask = () => {
    navigation.navigate(
      "AddTaskNonTimeBased",
      {
        groupId: Number(groupId),
        groupName,
      }
    );
  };

  const handleMembers = () => {
    navigation.navigate(
      "GroupMembersScreen",
      {
        groupId: Number(groupId),
        groupName,
      }
    );
  };

  const handleTaskPress = (task) => {
    navigation.navigate(
      "TaskGroupOverviewScreen",
      {
        task,
        groupId: Number(groupId),
        groupName,
      }
    );
  };

  const handleAddMember = () => {
    navigation.navigate(
      "AddMember",
      {
        groupId: Number(groupId),
        groupName,
      }
    );
  };

  const primaryColor =
    theme.primary || "#2563EB";

  const cardBg =
    theme.card || "#FFFFFF";

  const textColor =
    theme.text || "#0F172A";

  const subTextColor =
    theme.subText || "#64748B";

  const borderColor =
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

  const completedTasks =
    tasks.filter(
      (task) =>
        String(
          task.status
        ).toLowerCase() === "done" ||
        String(
          task.status
        ).toLowerCase() === "completed"
    );

  const pendingTasks =
    tasks.filter(
      (task) =>
        String(
          task.status
        ).toLowerCase() !== "done" &&
        String(
          task.status
        ).toLowerCase() !== "completed"
    );

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
              borderColor,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            navigation.goBack()
          }
          activeOpacity={0.7}
        >
          <Icon
            name="arrow-back"
            size={24}
            color={textColor}
          />
        </TouchableOpacity>

        <View
          style={styles.headerCenter}
        >
          <Text
            style={[
              styles.headerTitle,
              {
                color: textColor,
              },
            ]}
            numberOfLines={1}
          >
            {groupName}
          </Text>

          <Text
            style={[
              styles.headerSubtitle,
              {
                color: subTextColor,
              },
            ]}
          >
            Group Dashboard
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.headerAddButton
          }
          onPress={handleAddMember}
          activeOpacity={0.7}
        >
          <Icon
            name="person-add-outline"
            size={23}
            color={primaryColor}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={
              handleRefresh
            }
          />
        }
      >
        <View
          style={
            styles.responsiveWrapper
          }
        >
          <View
            style={[
              styles.groupCard,
              {
                backgroundColor:
                  cardBg,
                borderColor:
                  borderColor,
              },
            ]}
          >
            <View
              style={[
                styles.groupIcon,
                {
                  backgroundColor:
                    primaryColor,
                },
              ]}
            >
              <Icon
                name="people"
                size={30}
                color="#FFFFFF"
              />
            </View>

            <View
              style={styles.groupInfo}
            >
              <Text
                style={[
                  styles.groupTitle,
                  {
                    color:
                      textColor,
                  },
                ]}
                numberOfLines={1}
              >
                {groupName}
              </Text>

              <Text
                style={[
                  styles.groupSubtitle,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                Group task management
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.membersCard,
              {
                backgroundColor:
                  cardBg,
                borderColor:
                  borderColor,
              },
            ]}
            onPress={
              handleMembers
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.membersIcon,
                {
                  backgroundColor:
                    inputBg,
                },
              ]}
            >
              <Icon
                name="people-outline"
                size={25}
                color={primaryColor}
              />
            </View>

            <View
              style={styles.membersInfo}
            >
              <Text
                style={[
                  styles.membersTitle,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                Total Group Members
              </Text>

              <Text
                style={[
                  styles.membersCount,
                  {
                    color:
                      primaryColor,
                  },
                ]}
              >
                {members.length}
              </Text>
            </View>

            <Icon
              name="chevron-forward"
              size={22}
              color={subTextColor}
            />
          </TouchableOpacity>

          <View
            style={styles.sectionHeader}
          >
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    textColor,
                },
              ]}
            >
              Group Tasks
            </Text>

            <Text
              style={[
                styles.taskCount,
                {
                  color:
                    subTextColor,
                },
              ]}
            >
              {tasks.length} total
            </Text>
          </View>

          <View
            style={styles.statsRow}
          >
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    cardBg,
                  borderColor:
                    borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statNumber,
                  {
                    color:
                      primaryColor,
                  },
                ]}
              >
                {pendingTasks.length}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                Pending
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    cardBg,
                  borderColor:
                    borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statNumber,
                  {
                    color:
                      "#16A34A",
                  },
                ]}
              >
                {completedTasks.length}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                Completed
              </Text>
            </View>
          </View>

          {loading ? (
            <View
              style={
                styles.loadingContainer
              }
            >
              <ActivityIndicator
                size="large"
                color={
                  primaryColor
                }
              />

              <Text
                style={[
                  styles.loadingText,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                Loading group...
              </Text>
            </View>
          ) : tasks.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor:
                    cardBg,
                  borderColor:
                    borderColor,
                },
              ]}
            >
              <Icon
                name="clipboard-outline"
                size={50}
                color={
                  subTextColor
                }
              />

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color:
                      textColor,
                  },
                ]}
              >
                No Group Tasks
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  {
                    color:
                      subTextColor,
                  },
                ]}
              >
                Add a task to this
                group to get started.
              </Text>
            </View>
          ) : (
            <View>
              {tasks.map(
                (task, index) => {
                  const isCompleted =
                    String(
                      task.status
                    ).toLowerCase() ===
                      "done" ||
                    String(
                      task.status
                    ).toLowerCase() ===
                      "completed";

                  return (
                    <TouchableOpacity
                      key={String(
                        task.id ??
                          index
                      )}
                      style={[
                        styles.taskCard,
                        {
                          backgroundColor:
                            cardBg,
                          borderColor:
                            borderColor,
                        },
                      ]}
                      onPress={() =>
                        handleTaskPress(
                          task
                        )
                      }
                      activeOpacity={
                        0.75
                      }
                    >
                      <View
                        style={[
                          styles.taskIcon,
                          {
                            backgroundColor:
                              task.isTimeBased
                                ? primaryColor
                                : "#7C3AED",
                          },
                        ]}
                      >
                        <Icon
                          name={
                            task.isTimeBased
                              ? "time-outline"
                              : "clipboard-outline"
                          }
                          size={22}
                          color="#FFFFFF"
                        />
                      </View>

                      <View
                        style={
                          styles.taskInfo
                        }
                      >
                        <Text
                          style={[
                            styles.taskTitle,
                            {
                              color:
                                textColor,
                            },
                          ]}
                          numberOfLines={
                            2
                          }
                        >
                          {task.title}
                        </Text>

                        {task.description ? (
                          <Text
                            style={[
                              styles.taskDescription,
                              {
                                color:
                                  subTextColor,
                              },
                            ]}
                            numberOfLines={
                              2
                            }
                          >
                            {
                              task.description
                            }
                          </Text>
                        ) : null}

                        <View
                          style={
                            styles.taskMeta
                          }
                        >
                          {task.dueDate ? (
                            <View
                              style={
                                styles.metaItem
                              }
                            >
                              <Icon
                                name="calendar-outline"
                                size={14}
                                color={
                                  subTextColor
                                }
                              />

                              <Text
                                style={[
                                  styles.metaText,
                                  {
                                    color:
                                      subTextColor,
                                  },
                                ]}
                              >
                                {
                                  task.dueDate
                                }
                              </Text>
                            </View>
                          ) : null}

                          {task.dueTime ? (
                            <View
                              style={
                                styles.metaItem
                              }
                            >
                              <Icon
                                name="time-outline"
                                size={14}
                                color={
                                  subTextColor
                                }
                              />

                              <Text
                                style={[
                                  styles.metaText,
                                  {
                                    color:
                                      subTextColor,
                                  },
                                ]}
                              >
                                {
                                  task.dueTime
                                }
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {task.createdByName ? (
                          <Text
                            style={[
                              styles.createdByText,
                              {
                                color:
                                  subTextColor,
                              },
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            Created by:{" "}
                            {
                              task.createdByName
                            }
                          </Text>
                        ) : null}

                        {task.assignedToName ? (
                          <Text
                            style={[
                              styles.assignedText,
                              {
                                color:
                                  primaryColor,
                              },
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            Assigned to:{" "}
                            {
                              task.assignedToName
                            }
                          </Text>
                        ) : null}

                        {task.mentions?.length >
                        0 ? (
                          <Text
                            style={[
                              styles.mentionText,
                              {
                                color:
                                  "#7C3AED",
                              },
                            ]}
                            numberOfLines={
                              2
                            }
                          >
                            Mentioned:{" "}
                            {task.mentions
                              .map(
                                (
                                  mention
                                ) =>
                                  mention?.mentionedUserName ||
                                  mention?.MentionedUserName ||
                                  ""
                              )
                              .filter(
                                Boolean
                              )
                              .join(
                                ", "
                              )}
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              isCompleted
                                ? "#DCFCE7"
                                : inputBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                isCompleted
                                  ? "#16A34A"
                                  : primaryColor,
                            },
                          ]}
                        >
                          {
                            task.status
                          }
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          )}

          <View
            style={
              styles.actionSection
            }
          >
            <Text
              style={[
                styles.actionTitle,
                {
                  color:
                    textColor,
                },
              ]}
            >
              Add Group Task
            </Text>

            <View
              style={styles.actionRow}
            >
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor:
                      primaryColor,
                  },
                ]}
                onPress={
                  handleAddTimeTask
                }
                activeOpacity={0.8}
              >
                <Icon
                  name="time-outline"
                  size={22}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.actionButtonText
                  }
                >
                  Time Based
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor:
                      "#7C3AED",
                  },
                ]}
                onPress={
                  handleAddNonTimeTask
                }
                activeOpacity={0.8}
              >
                <Icon
                  name="clipboard-outline"
                  size={22}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.actionButtonText
                  }
                >
                  Non-Time
                </Text>
              </TouchableOpacity>
            </View>
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
              borderColor,
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
          activeOpacity={0.7}
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
          onPress={
            handleMembers
          }
          activeOpacity={0.7}
        >
          <Icon
            name="people"
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
          activeOpacity={0.7}
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
          activeOpacity={0.7}
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
    </SafeAreaView>
  );
};

export default GroupDashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  responsiveWrapper: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
  },

  groupCard: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  groupIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  groupInfo: {
    flex: 1,
  },

  groupTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  groupSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  membersCard: {
    minHeight: 78,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  membersIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  membersInfo: {
    flex: 1,
  },

  membersTitle: {
    fontSize: 13,
    fontWeight: "700",
  },

  membersCount: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  taskCount: {
    fontSize: 12,
  },

  statsRow: {
    flexDirection:
      width < 360
        ? "column"
        : "row",
    gap: 10,
    marginBottom: 14,
  },

  statCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  statNumber: {
    fontSize: 23,
    fontWeight: "800",
  },

  statLabel: {
    fontSize: 11,
    marginTop: 3,
  },

  loadingContainer: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },

  emptyCard: {
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    marginBottom: 20,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyText: {
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },

  taskCard: {
    minHeight: 105,
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    elevation: 1,
  },

  taskIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  taskInfo: {
    flex: 1,
    paddingRight: 5,
  },

  taskTitle: {
    fontSize: 15,
    fontWeight: "750",
  },

  taskDescription: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 7,
    gap: 10,
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  metaText: {
    fontSize: 10,
  },

  createdByText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
  },

  assignedText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },

  mentionText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },

  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },

  statusText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  actionSection: {
    marginTop: 10,
  },

  actionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  actionRow: {
    flexDirection:
      width < 360
        ? "column"
        : "row",
    gap: 10,
  },

  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 8,
    elevation: 2,
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 65,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    elevation: 10,
  },

  iconBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },

  bottomNavText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
});


























































// import React, {
//   useCallback,
//   useEffect,
//   useState,
// } from "react";

// import {
//   SafeAreaView,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   Alert,
//   ActivityIndicator,
//   StatusBar,
//   Dimensions,
//   RefreshControl,
// } from "react-native";

// import Icon from "@react-native-vector-icons/ionicons";
// import AsyncStorage from "@react-native-async-storage/async-storage";

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

// const GroupDashboard = ({ navigation, route }) => {
//   const { theme } = useTheme();

//   const groupId = route?.params?.groupId ?? null;

//   const routeGroupName =
//     route?.params?.groupName ||
//     route?.params?.name ||
//     "GROUP";

//   const [groupName, setGroupName] = useState(
//     String(routeGroupName).toUpperCase()
//   );

//   const [tasks, setTasks] = useState([]);
//   const [members, setMembers] = useState([]);

//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   const getToken = async () => {
//     try {
//       const token = await AsyncStorage.getItem("token");

//       if (!token) {
//         Alert.alert(
//           "Session Expired",
//           "Please login again.",
//           [
//             {
//               text: "OK",
//               onPress: () => goToLogin(navigation),
//             },
//           ]
//         );

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

//     const response = await fetch(
//       `${BASE_URL}${endpoint}`,
//       {
//         ...options,
//         headers: {
//           Accept: "application/json",
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//           ...(options.headers || {}),
//         },
//       }
//     );

//     let data = null;

//     try {
//       const text = await response.text();

//       if (text) {
//         data = JSON.parse(text);
//       }
//     } catch (error) {
//       console.log("Response JSON Parse Error:", error);
//     }

//     console.log(
//       `API ${options.method || "GET"} ${endpoint}:`,
//       response.status,
//       data
//     );

//     if (response.status === 401) {
//       await AsyncStorage.removeItem("token");

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

//     return {
//       ...member,
//       id: userId,
//       userId,
//       name: String(name).trim() || "Unknown Member",
//       phone: String(phone).trim(),
//       uniqueKey: `${userId || "member"}-${index}`,
//     };
//   };

//   const normalizeTask = (task, index) => {
//     return {
//       ...task,
//       id:
//         task?.id ??
//         task?.Id ??
//         task?.taskId ??
//         task?.TaskId ??
//         index,
//       title:
//         task?.title ||
//         task?.Title ||
//         "Untitled Task",
//       description:
//         task?.description ||
//         task?.Description ||
//         "",
//       status:
//         task?.status ||
//         task?.Status ||
//         "Pending",
//       dueDate:
//         task?.dueDate ||
//         task?.DueDate ||
//         null,
//       dueTime:
//         task?.dueTime ||
//         task?.DueTime ||
//         null,
//       isTimeBased:
//         task?.isTimeBased ??
//         task?.IsTimeBased ??
//         false,
//       assignedToName:
//         task?.assignedToName ||
//         task?.assignedUserName ||
//         task?.assignedTo ||
//         task?.AssignedToName ||
//         "",
//       createdByName:
//         task?.createdByName ||
//         task?.createdByUserName ||
//         task?.createdBy ||
//         task?.CreatedByName ||
//         "",
//     };
//   };

//   const fetchGroupData = useCallback(
//     async (showLoader = true) => {
//       if (
//         groupId === null ||
//         groupId === undefined ||
//         String(groupId).trim() === ""
//       ) {
//         Alert.alert(
//           "Group Error",
//           "Group ID was not provided."
//         );

//         setLoading(false);
//         return;
//       }

//       try {
//         if (showLoader) {
//           setLoading(true);
//         }

//         const [groupsResponse, groupTasksResponse] =
//           await Promise.all([
//             apiFetch("/Task/groups"),
//             apiFetch(
//               `/Task/group?groupId=${encodeURIComponent(
//                 groupId
//               )}&tab=ALL&isTimeBased=false`
//             ),
//           ]);

//         console.log(
//           "Group Information:",
//           groupsResponse
//         );

//         console.log(
//           "Group Tasks:",
//           groupTasksResponse
//         );

//         const groups = Array.isArray(
//           groupsResponse?.data
//         )
//           ? groupsResponse.data
//           : [];

//         const selectedGroup = groups.find(
//           (group) =>
//             String(
//               group?.id ??
//                 group?.groupId ??
//                 group?.Id ??
//                 ""
//             ) === String(groupId)
//         );

//         if (selectedGroup) {
//           const name =
//             selectedGroup?.name ||
//             selectedGroup?.Name ||
//             routeGroupName;

//           setGroupName(
//             String(name).toUpperCase()
//           );

//           const groupMembers = Array.isArray(
//             selectedGroup?.members
//           )
//             ? selectedGroup.members
//             : [];

//           setMembers(
//             groupMembers.map(
//               normalizeMember
//             )
//           );
//         } else {
//           setGroupName(
//             String(routeGroupName).toUpperCase()
//           );
//           setMembers([]);
//         }

//         const taskList =
//           Array.isArray(
//             groupTasksResponse?.data
//           )
//             ? groupTasksResponse.data
//             : Array.isArray(
//                 groupTasksResponse
//               )
//             ? groupTasksResponse
//             : [];

//         setTasks(
//           taskList.map(normalizeTask)
//         );
//       } catch (error) {
//         console.log(
//           "Fetch Group Dashboard Error:",
//           error
//         );

//         if (
//           error?.message !==
//             "Authentication required" &&
//           error?.message !==
//             "Session expired"
//         ) {
//           Alert.alert(
//             "Error",
//             error?.message ||
//               "Failed to load group dashboard."
//           );
//         }
//       } finally {
//         setLoading(false);
//       }
//     },
//     [groupId, routeGroupName]
//   );

//   useEffect(() => {
//     fetchGroupData(true);
//   }, [fetchGroupData]);

//   const handleRefresh = async () => {
//     try {
//       setRefreshing(true);
//       await fetchGroupData(false);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   const handleAddTimeTask = () => {
//     navigation.navigate(
//       "AddTaskTimeBased",
//       {
//         groupId: Number(groupId),
//         groupName,
//       }
//     );
//   };

//   const handleAddNonTimeTask = () => {
//     navigation.navigate(
//       "AddTaskNonTimeBased",
//       {
//         groupId: Number(groupId),
//         groupName,
//       }
//     );
//   };

//   const handleMembers = () => {
//     navigation.navigate(
//       "GroupMembersScreen",
//       {
//         groupId: Number(groupId),
//         groupName,
//       }
//     );
//   };

//   const handleTaskPress = (task) => {
//     navigation.navigate(
//       "TaskGroupOverviewScreen",
//       {
//         task,
//         groupId: Number(groupId),
//         groupName,
//       }
//     );
//   };

//   const handleAddMember = () => {
//     navigation.navigate(
//       "AddMember",
//       {
//         groupId: Number(groupId),
//         groupName,
//       }
//     );
//   };

//   const primaryColor =
//     theme.primary || "#2563EB";

//   const cardBg =
//     theme.card || "#FFFFFF";

//   const textColor =
//     theme.text || "#0F172A";

//   const subTextColor =
//     theme.subText || "#64748B";

//   const borderColor =
//     theme.border || "#E2E8F0";

//   const inputBg =
//     theme.inputBg ||
//     (theme.bg === "#000000" ||
//     theme.bg === "#0F172A"
//       ? "#1E293B"
//       : "#F8FAFC");

//   const isDark =
//     theme.bg === "#000000" ||
//     theme.bg === "#0F172A";

//   const completedTasks = tasks.filter(
//     (task) =>
//       String(task.status).toLowerCase() ===
//         "done" ||
//       String(task.status).toLowerCase() ===
//         "completed"
//   );

//   const pendingTasks = tasks.filter(
//     (task) =>
//       String(task.status).toLowerCase() !==
//         "done" &&
//       String(task.status).toLowerCase() !==
//         "completed"
//   );

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
//             borderBottomColor: borderColor,
//           },
//         ]}
//       >
//         <TouchableOpacity
//           style={styles.backButton}
//           onPress={() =>
//             navigation.goBack()
//           }
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="arrow-back"
//             size={24}
//             color={textColor}
//           />
//         </TouchableOpacity>

//         <View style={styles.headerCenter}>
//           <Text
//             style={[
//               styles.headerTitle,
//               {
//                 color: textColor,
//               },
//             ]}
//             numberOfLines={1}
//           >
//             {groupName}
//           </Text>

//           <Text
//             style={[
//               styles.headerSubtitle,
//               {
//                 color: subTextColor,
//               },
//             ]}
//           >
//             Group Dashboard
//           </Text>
//         </View>

//         <TouchableOpacity
//           style={styles.headerAddButton}
//           onPress={handleAddMember}
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="person-add-outline"
//             size={23}
//             color={primaryColor}
//           />
//         </TouchableOpacity>
//       </View>

//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={
//           styles.content
//         }
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={handleRefresh}
//           />
//         }
//       >
//         <View
//           style={[
//             styles.responsiveWrapper,
//           ]}
//         >
//           <View
//             style={[
//               styles.groupCard,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderColor,
//               },
//             ]}
//           >
//             <View
//               style={[
//                 styles.groupIcon,
//                 {
//                   backgroundColor:
//                     primaryColor,
//                 },
//               ]}
//             >
//               <Icon
//                 name="people"
//                 size={30}
//                 color="#FFFFFF"
//               />
//             </View>

//             <View
//               style={styles.groupInfo}
//             >
//               <Text
//                 style={[
//                   styles.groupTitle,
//                   {
//                     color: textColor,
//                   },
//                 ]}
//                 numberOfLines={1}
//               >
//                 {groupName}
//               </Text>

//               <Text
//                 style={[
//                   styles.groupSubtitle,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 Group task management
//               </Text>
//             </View>
//           </View>

//           <TouchableOpacity
//             style={[
//               styles.membersCard,
//               {
//                 backgroundColor: cardBg,
//                 borderColor: borderColor,
//               },
//             ]}
//             onPress={handleMembers}
//             activeOpacity={0.75}
//           >
//             <View
//               style={[
//                 styles.membersIcon,
//                 {
//                   backgroundColor:
//                     inputBg,
//                 },
//               ]}
//             >
//               <Icon
//                 name="people-outline"
//                 size={25}
//                 color={primaryColor}
//               />
//             </View>

//             <View
//               style={styles.membersInfo}
//             >
//               <Text
//                 style={[
//                   styles.membersTitle,
//                   {
//                     color: textColor,
//                   },
//                 ]}
//               >
//                 Total Group Members
//               </Text>

//               <Text
//                 style={[
//                   styles.membersCount,
//                   {
//                     color: primaryColor,
//                   },
//                 ]}
//               >
//                 {members.length}
//               </Text>
//             </View>

//             <Icon
//               name="chevron-forward"
//               size={22}
//               color={subTextColor}
//             />
//           </TouchableOpacity>

//           <View
//             style={styles.sectionHeader}
//           >
//             <Text
//               style={[
//                 styles.sectionTitle,
//                 {
//                   color: textColor,
//                 },
//               ]}
//             >
//               Group Tasks
//             </Text>

//             <Text
//               style={[
//                 styles.taskCount,
//                 {
//                   color: subTextColor,
//                 },
//               ]}
//             >
//               {tasks.length} total
//             </Text>
//           </View>

//           <View
//             style={styles.statsRow}
//           >
//             <View
//               style={[
//                 styles.statCard,
//                 {
//                   backgroundColor: cardBg,
//                   borderColor: borderColor,
//                 },
//               ]}
//             >
//               <Text
//                 style={[
//                   styles.statNumber,
//                   {
//                     color: primaryColor,
//                   },
//                 ]}
//               >
//                 {pendingTasks.length}
//               </Text>

//               <Text
//                 style={[
//                   styles.statLabel,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 Pending
//               </Text>
//             </View>

//             <View
//               style={[
//                 styles.statCard,
//                 {
//                   backgroundColor: cardBg,
//                   borderColor: borderColor,
//                 },
//               ]}
//             >
//               <Text
//                 style={[
//                   styles.statNumber,
//                   {
//                     color: "#16A34A",
//                   },
//                 ]}
//               >
//                 {completedTasks.length}
//               </Text>

//               <Text
//                 style={[
//                   styles.statLabel,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 Completed
//               </Text>
//             </View>
//           </View>

//           {loading ? (
//             <View
//               style={styles.loadingContainer}
//             >
//               <ActivityIndicator
//                 size="large"
//                 color={primaryColor}
//               />

//               <Text
//                 style={[
//                   styles.loadingText,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 Loading group...
//               </Text>
//             </View>
//           ) : tasks.length === 0 ? (
//             <View
//               style={[
//                 styles.emptyCard,
//                 {
//                   backgroundColor: cardBg,
//                   borderColor: borderColor,
//                 },
//               ]}
//             >
//               <Icon
//                 name="clipboard-outline"
//                 size={50}
//                 color={subTextColor}
//               />

//               <Text
//                 style={[
//                   styles.emptyTitle,
//                   {
//                     color: textColor,
//                   },
//                 ]}
//               >
//                 No Group Tasks
//               </Text>

//               <Text
//                 style={[
//                   styles.emptyText,
//                   {
//                     color: subTextColor,
//                   },
//                 ]}
//               >
//                 Add a task to this group
//                 to get started.
//               </Text>
//             </View>
//           ) : (
//             <View>
//               {tasks.map(
//                 (task, index) => (
//                   <TouchableOpacity
//                     key={String(
//                       task.id ?? index
//                     )}
//                     style={[
//                       styles.taskCard,
//                       {
//                         backgroundColor:
//                           cardBg,
//                         borderColor:
//                           borderColor,
//                       },
//                     ]}
//                     onPress={() =>
//                       handleTaskPress(
//                         task
//                       )
//                     }
//                     activeOpacity={0.75}
//                   >
//                     <View
//                       style={[
//                         styles.taskIcon,
//                         {
//                           backgroundColor:
//                             task.isTimeBased
//                               ? primaryColor
//                               : "#7C3AED",
//                         },
//                       ]}
//                     >
//                       <Icon
//                         name={
//                           task.isTimeBased
//                             ? "time-outline"
//                             : "clipboard-outline"
//                         }
//                         size={22}
//                         color="#FFFFFF"
//                       />
//                     </View>

//                     <View
//                       style={
//                         styles.taskInfo
//                       }
//                     >
//                       <Text
//                         style={[
//                           styles.taskTitle,
//                           {
//                             color:
//                               textColor,
//                           },
//                         ]}
//                         numberOfLines={2}
//                       >
//                         {task.title}
//                       </Text>

//                       {task.description ? (
//                         <Text
//                           style={[
//                             styles.taskDescription,
//                             {
//                               color:
//                                 subTextColor,
//                             },
//                           ]}
//                           numberOfLines={2}
//                         >
//                           {
//                             task.description
//                           }
//                         </Text>
//                       ) : null}

//                       <View
//                         style={
//                           styles.taskMeta
//                         }
//                       >
//                         {task.dueDate ? (
//                           <View
//                             style={
//                               styles.metaItem
//                             }
//                           >
//                             <Icon
//                               name="calendar-outline"
//                               size={14}
//                               color={
//                                 subTextColor
//                               }
//                             />

//                             <Text
//                               style={[
//                                 styles.metaText,
//                                 {
//                                   color:
//                                     subTextColor,
//                                 },
//                               ]}
//                             >
//                               {
//                                 task.dueDate
//                               }
//                             </Text>
//                           </View>
//                         ) : null}

//                         {task.dueTime ? (
//                           <View
//                             style={
//                               styles.metaItem
//                             }
//                           >
//                             <Icon
//                               name="time-outline"
//                               size={14}
//                               color={
//                                 subTextColor
//                               }
//                             />

//                             <Text
//                               style={[
//                                 styles.metaText,
//                                 {
//                                   color:
//                                     subTextColor,
//                                 },
//                               ]}
//                             >
//                               {
//                                 task.dueTime
//                               }
//                             </Text>
//                           </View>
//                         ) : null}
//                       </View>

//                       {task.assignedToName ? (
//                         <Text
//                           style={[
//                             styles.assignedText,
//                             {
//                               color:
//                                 primaryColor,
//                             },
//                           ]}
//                           numberOfLines={1}
//                         >
//                           Assigned to:{" "}
//                           {
//                             task.assignedToName
//                           }
//                         </Text>
//                       ) : null}
//                     </View>

//                     <View
//                       style={[
//                         styles.statusBadge,
//                         {
//                           backgroundColor:
//                             String(
//                               task.status
//                             ).toLowerCase() ===
//                               "done" ||
//                             String(
//                               task.status
//                             ).toLowerCase() ===
//                               "completed"
//                               ? "#DCFCE7"
//                               : inputBg,
//                         },
//                       ]}
//                     >
//                       <Text
//                         style={[
//                           styles.statusText,
//                           {
//                             color:
//                               String(
//                                 task.status
//                               ).toLowerCase() ===
//                                 "done" ||
//                               String(
//                                 task.status
//                               ).toLowerCase() ===
//                                 "completed"
//                                 ? "#16A34A"
//                                 : primaryColor,
//                           },
//                         ]}
//                       >
//                         {task.status}
//                       </Text>
//                     </View>
//                   </TouchableOpacity>
//                 )
//               )}
//             </View>
//           )}

//           <View
//             style={
//               styles.actionSection
//             }
//           >
//             <Text
//               style={[
//                 styles.actionTitle,
//                 {
//                   color: textColor,
//                 },
//               ]}
//             >
//               Add Group Task
//             </Text>

//             <View
//               style={styles.actionRow}
//             >
//               <TouchableOpacity
//                 style={[
//                   styles.actionButton,
//                   {
//                     backgroundColor:
//                       primaryColor,
//                   },
//                 ]}
//                 onPress={
//                   handleAddTimeTask
//                 }
//                 activeOpacity={0.8}
//               >
//                 <Icon
//                   name="time-outline"
//                   size={22}
//                   color="#FFFFFF"
//                 />

//                 <Text
//                   style={
//                     styles.actionButtonText
//                   }
//                 >
//                   Time Based
//                 </Text>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={[
//                   styles.actionButton,
//                   {
//                     backgroundColor:
//                       "#7C3AED",
//                   },
//                 ]}
//                 onPress={
//                   handleAddNonTimeTask
//                 }
//                 activeOpacity={0.8}
//               >
//                 <Icon
//                   name="clipboard-outline"
//                   size={22}
//                   color="#FFFFFF"
//                 />

//                 <Text
//                   style={
//                     styles.actionButtonText
//                   }
//                 >
//                   Non-Time
//                 </Text>
//               </TouchableOpacity>
//             </View>
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
//                 ? "#1E293B"
//                 : "#0F172A"),
//             borderTopColor:
//               borderColor,
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
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="home"
//             size={22}
//             color="#FFFFFF"
//           />

//           <Text
//             style={styles.bottomNavText}
//           >
//             Home
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.iconBtn}
//           onPress={handleMembers}
//           activeOpacity={0.7}
//         >
//           <Icon
//             name="people"
//             size={22}
//             color="#FFFFFF"
//           />

//           <Text
//             style={styles.bottomNavText}
//           >
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

//           <Text
//             style={styles.bottomNavText}
//           >
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

//           <Text
//             style={styles.bottomNavText}
//           >
//             Settings
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default GroupDashboard;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },

//   header: {
//     height: 70,
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 14,
//     borderBottomWidth: 1,
//   },

//   backButton: {
//     width: 44,
//     height: 44,
//     alignItems: "center",
//     justifyContent: "center",
//     borderRadius: 22,
//   },

//   headerCenter: {
//     flex: 1,
//     alignItems: "center",
//     paddingHorizontal: 10,
//   },

//   headerTitle: {
//     fontSize: 17,
//     fontWeight: "800",
//     textTransform: "uppercase",
//   },

//   headerSubtitle: {
//     fontSize: 11,
//     marginTop: 2,
//   },

//   headerAddButton: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   content: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 100,
//   },

//   responsiveWrapper: {
//     width: "100%",
//     maxWidth: 650,
//     alignSelf: "center",
//   },

//   groupCard: {
//     minHeight: 90,
//     borderRadius: 16,
//     borderWidth: 1,
//     padding: 16,
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 14,
//     elevation: 2,
//     shadowColor: "#000",
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.05,
//     shadowRadius: 4,
//   },

//   groupIcon: {
//     width: 58,
//     height: 58,
//     borderRadius: 29,
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 13,
//   },

//   groupInfo: {
//     flex: 1,
//   },

//   groupTitle: {
//     fontSize: 20,
//     fontWeight: "800",
//   },

//   groupSubtitle: {
//     fontSize: 12,
//     marginTop: 4,
//   },

//   membersCard: {
//     minHeight: 78,
//     borderRadius: 15,
//     borderWidth: 1,
//     paddingHorizontal: 14,
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 20,
//   },

//   membersIcon: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 12,
//   },

//   membersInfo: {
//     flex: 1,
//   },

//   membersTitle: {
//     fontSize: 13,
//     fontWeight: "700",
//   },

//   membersCount: {
//     fontSize: 22,
//     fontWeight: "800",
//     marginTop: 2,
//   },

//   sectionHeader: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     marginBottom: 10,
//   },

//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: "800",
//   },

//   taskCount: {
//     fontSize: 12,
//   },

//   statsRow: {
//     flexDirection:
//       width < 360
//         ? "column"
//         : "row",
//     gap: 10,
//     marginBottom: 14,
//   },

//   statCard: {
//     flex: 1,
//     minHeight: 76,
//     borderRadius: 14,
//     borderWidth: 1,
//     padding: 12,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   statNumber: {
//     fontSize: 23,
//     fontWeight: "800",
//   },

//   statLabel: {
//     fontSize: 11,
//     marginTop: 3,
//   },

//   loadingContainer: {
//     minHeight: 220,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   loadingText: {
//     marginTop: 10,
//     fontSize: 13,
//   },

//   emptyCard: {
//     minHeight: 220,
//     borderRadius: 16,
//     borderWidth: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     padding: 20,
//     marginBottom: 20,
//   },

//   emptyTitle: {
//     fontSize: 17,
//     fontWeight: "800",
//     marginTop: 12,
//   },

//   emptyText: {
//     fontSize: 12,
//     marginTop: 5,
//     textAlign: "center",
//   },

//   taskCard: {
//     minHeight: 105,
//     borderRadius: 15,
//     borderWidth: 1,
//     padding: 12,
//     flexDirection: "row",
//     alignItems: "flex-start",
//     marginBottom: 10,
//     elevation: 1,
//   },

//   taskIcon: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     alignItems: "center",
//     justifyContent: "center",
//     marginRight: 11,
//   },

//   taskInfo: {
//     flex: 1,
//     paddingRight: 5,
//   },

//   taskTitle: {
//     fontSize: 15,
//     fontWeight: "750",
//   },

//   taskDescription: {
//     fontSize: 11,
//     lineHeight: 16,
//     marginTop: 4,
//   },

//   taskMeta: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//     marginTop: 7,
//     gap: 10,
//   },

//   metaItem: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 4,
//   },

//   metaText: {
//     fontSize: 10,
//   },

//   assignedText: {
//     fontSize: 10,
//     fontWeight: "700",
//     marginTop: 6,
//   },

//   statusBadge: {
//     borderRadius: 20,
//     paddingHorizontal: 8,
//     paddingVertical: 5,
//     alignSelf: "flex-start",
//   },

//   statusText: {
//     fontSize: 9,
//     fontWeight: "800",
//     textTransform: "uppercase",
//   },

//   actionSection: {
//     marginTop: 10,
//   },

//   actionTitle: {
//     fontSize: 16,
//     fontWeight: "800",
//     marginBottom: 10,
//   },

//   actionRow: {
//     flexDirection:
//       width < 360
//         ? "column"
//         : "row",
//     gap: 10,
//   },

//   actionButton: {
//     flex: 1,
//     minHeight: 52,
//     borderRadius: 13,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     paddingHorizontal: 12,
//     gap: 8,
//     elevation: 2,
//   },

//   actionButtonText: {
//     color: "#FFFFFF",
//     fontSize: 13,
//     fontWeight: "800",
//   },

//   bottom: {
//     position: "absolute",
//     left: 0,
//     right: 0,
//     bottom: 0,
//     height: 65,
//     flexDirection: "row",
//     justifyContent: "space-around",
//     alignItems: "center",
//     borderTopWidth: 1,
//     elevation: 10,
//   },

//   iconBtn: {
//     flex: 1,
//     minHeight: 48,
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: 5,
//   },

//   bottomNavText: {
//     color: "#FFFFFF",
//     fontSize: 10,
//     fontWeight: "600",
//     marginTop: 3,
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

















































// // // import React, { useState, useCallback } from 'react';

// // // import {
// // //   View,
// // //   Text,
// // //   StyleSheet,
// // //   SafeAreaView,
// // //   TouchableOpacity,
// // //   ScrollView,
// // //   ActivityIndicator,
// // //   Alert,
// // //   StatusBar,
// // //   Platform,
// // //   Dimensions,
// // // } from 'react-native';

// // // import Icon from '@react-native-vector-icons/ionicons';
// // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // import { useTheme } from '../../context/ThemeContext';
// // // import { useFocusEffect } from '@react-navigation/native';
// // // import { BASE_URL } from '../../config/api';

// // // const { width: SCREEN_WIDTH } = Dimensions.get('window');

// // // const goToLogin = navigation => {
// // //   navigation.reset({
// // //     index: 0,
// // //     routes: [
// // //       {
// // //         name: 'AuthStack',
// // //         state: {
// // //           routes: [{ name: 'Login' }],
// // //         },
// // //       },
// // //     ],
// // //   });
// // // };

// // // const GroupDashboard = ({ navigation, route }) => {
// // //   const { isDark, theme } = useTheme();

// // //   const targetGroupName = (
// // //     route?.params?.groupName || ''
// // //   ).toUpperCase();

// // //   const [selectedTab, setSelectedTab] = useState('ALL');
// // //   const [selectedMode, setSelectedMode] = useState('time');

// // //   const [tasks, setTasks] = useState([]);
// // //   const [loading, setLoading] = useState(false);

// // //   const [groupId, setGroupId] = useState(null);
// // //   const [allGroupNames, setAllGroupNames] = useState([]);
// // //   const [memberCount, setMemberCount] = useState(0);

// // //   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

// // //   const categories = [
// // //     'SELF',
// // //     ...allGroupNames.filter(
// // //       (group, index, array) =>
// // //         array.indexOf(group) === index
// // //     ),
// // //   ];

// // //   const getToken = async () => {
// // //     try {
// // //       const token = await AsyncStorage.getItem('token');

// // //       if (!token) {
// // //         Alert.alert(
// // //           'Session Expired',
// // //           'Your session has expired. Please login again.',
// // //           [
// // //             {
// // //               text: 'OK',
// // //               onPress: () => goToLogin(navigation),
// // //             },
// // //           ]
// // //         );

// // //         return null;
// // //       }

// // //       return token;
// // //     } catch (error) {
// // //       console.log('Get Token Error:', error);
// // //       return null;
// // //     }
// // //   };

// // //   const apiFetch = async (endpoint, options = {}) => {
// // //     const token = await getToken();

// // //     if (!token) {
// // //       throw new Error('Authentication required');
// // //     }

// // //     const response = await fetch(`${BASE_URL}${endpoint}`, {
// // //       ...options,
// // //       headers: {
// // //         Accept: 'application/json',
// // //         'Content-Type': 'application/json',
// // //         Authorization: `Bearer ${token}`,
// // //         ...(options.headers || {}),
// // //       },
// // //     });

// // //     let data = null;

// // //     try {
// // //       const text = await response.text();

// // //       if (text) {
// // //         data = JSON.parse(text);
// // //       }
// // //     } catch (error) {
// // //       console.log('Response JSON Parse Error:', error);
// // //       data = null;
// // //     }

// // //     console.log(
// // //       `API ${options.method || 'GET'} ${endpoint}:`,
// // //       response.status,
// // //       data
// // //     );

// // //     if (response.status === 401) {
// // //       await AsyncStorage.removeItem('token');

// // //       Alert.alert(
// // //         'Session Expired',
// // //         'Please login again.',
// // //         [
// // //           {
// // //             text: 'OK',
// // //             onPress: () => goToLogin(navigation),
// // //           },
// // //         ]
// // //       );

// // //       throw new Error('Session expired');
// // //     }

// // //     if (!response.ok) {
// // //       throw new Error(
// // //         data?.message ||
// // //           data?.error ||
// // //           `Request failed with status ${response.status}`
// // //       );
// // //     }

// // //     return data;
// // //   };

// // //   const fetchData = useCallback(async () => {
// // //     try {
// // //       setLoading(true);

// // //       const groupsResponse = await apiFetch('/Task/groups');

// // //       console.log(
// // //         'Fetch Groups Response:',
// // //         groupsResponse
// // //       );

// // //       if (
// // //         !groupsResponse ||
// // //         groupsResponse.success === false
// // //       ) {
// // //         setTasks([]);
// // //         setAllGroupNames([]);
// // //         setGroupId(null);
// // //         setMemberCount(0);
// // //         return;
// // //       }

// // //       const groups = Array.isArray(groupsResponse.data)
// // //         ? groupsResponse.data
// // //         : [];

// // //       const names = groups
// // //         .map(group => group?.name)
// // //         .filter(Boolean)
// // //         .map(name => name.toUpperCase());

// // //       setAllGroupNames(names);

// // //       const targetGroup = groups.find(
// // //         group =>
// // //           group?.name &&
// // //           group.name.toUpperCase() === targetGroupName
// // //       );

// // //       if (!targetGroup) {
// // //         console.log(
// // //           'Group not found:',
// // //           targetGroupName
// // //         );

// // //         setGroupId(null);
// // //         setMemberCount(0);
// // //         setTasks([]);

// // //         return;
// // //       }

// // //       const currentGroupId = targetGroup.id;

// // //       setGroupId(currentGroupId);

// // //       const members = Array.isArray(targetGroup.members)
// // //         ? targetGroup.members
// // //         : [];

// // //       const totalMembers =
// // //         targetGroup.memberCount !== undefined &&
// // //         targetGroup.memberCount !== null
// // //           ? Number(targetGroup.memberCount)
// // //           : members.length;

// // //       setMemberCount(
// // //         Number.isNaN(totalMembers)
// // //           ? members.length
// // //           : totalMembers
// // //       );

// // //       console.log(
// // //         'Selected Group:',
// // //         targetGroup.name
// // //       );

// // //       console.log(
// // //         'Selected Group ID:',
// // //         currentGroupId
// // //       );

// // //       console.log(
// // //         'Group Member Count:',
// // //         totalMembers
// // //       );

// // //       const isTimeBased =
// // //         selectedMode === 'time';

// // //       const tabParam =
// // //         selectedTab === 'ALL'
// // //           ? ''
// // //           : selectedTab.toLowerCase();

// // //       const query =
// // //         `/Task/group?tab=${encodeURIComponent(
// // //           tabParam
// // //         )}` +
// // //         `&isTimeBased=${isTimeBased}` +
// // //         `&groupId=${encodeURIComponent(
// // //           currentGroupId
// // //         )}`;

// // //       console.log(
// // //         'Fetching Group Tasks:',
// // //         `${BASE_URL}${query}`
// // //       );

// // //       const tasksResponse = await apiFetch(query);

// // //       console.log(
// // //         'Fetch Group Tasks Response:',
// // //         tasksResponse
// // //       );

// // //       if (
// // //         tasksResponse?.success !== false &&
// // //         Array.isArray(tasksResponse?.data)
// // //       ) {
// // //         setTasks(tasksResponse.data);
// // //       } else {
// // //         setTasks([]);
// // //       }
// // //     } catch (error) {
// // //       console.log(
// // //         'GroupDashboard fetchData Error:',
// // //         error
// // //       );

// // //       if (
// // //         error?.message !== 'Authentication required' &&
// // //         error?.message !== 'Session expired'
// // //       ) {
// // //         Alert.alert(
// // //           'Error',
// // //           error?.message ||
// // //             'Failed to load group tasks.'
// // //         );
// // //       }
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   }, [
// // //     targetGroupName,
// // //     selectedTab,
// // //     selectedMode,
// // //   ]);

// // //   useFocusEffect(
// // //     useCallback(() => {
// // //       fetchData();
// // //     }, [fetchData])
// // //   );

// // //   const handleMarkDone = async task => {
// // //     try {
// // //       setLoading(true);

// // //       await apiFetch(
// // //         `/Task/${task.id}/done`,
// // //         {
// // //           method: 'POST',
// // //         }
// // //       );

// // //       Alert.alert(
// // //         'Task Completed!',
// // //         `"${task.title}" has been marked as done.`
// // //       );

// // //       await fetchData();
// // //     } catch (error) {
// // //       console.log(
// // //         'Mark Done Error:',
// // //         error
// // //       );

// // //       if (
// // //         error?.message !== 'Authentication required' &&
// // //         error?.message !== 'Session expired'
// // //       ) {
// // //         Alert.alert(
// // //           'Error',
// // //           error?.message ||
// // //             'Failed to mark task as done.'
// // //         );
// // //       }
// // //     } finally {
// // //       setLoading(false);
// // //     }
// // //   };

// // //   const handleDeleteTask = taskId => {
// // //     Alert.alert(
// // //       'Delete Task',
// // //       'Are you sure you want to delete this task?',
// // //       [
// // //         {
// // //           text: 'Cancel',
// // //           style: 'cancel',
// // //         },
// // //         {
// // //           text: 'Delete',
// // //           style: 'destructive',
// // //           onPress: async () => {
// // //             try {
// // //               setLoading(true);

// // //               await apiFetch(
// // //                 `/Task/task/${taskId}`,
// // //                 {
// // //                   method: 'DELETE',
// // //                 }
// // //               );

// // //               Alert.alert(
// // //                 'Success',
// // //                 'Task deleted successfully.'
// // //               );

// // //               await fetchData();
// // //             } catch (error) {
// // //               console.log(
// // //                 'Delete Task Error:',
// // //                 error
// // //               );

// // //               if (
// // //                 error?.message !== 'Authentication required' &&
// // //                 error?.message !== 'Session expired'
// // //               ) {
// // //                 Alert.alert(
// // //                   'Error',
// // //                   error?.message ||
// // //                     'Failed to delete task.'
// // //                 );
// // //               }
// // //             } finally {
// // //               setLoading(false);
// // //             }
// // //           },
// // //         },
// // //       ]
// // //     );
// // //   };

// // //   const handleDeleteGroup = () => {
// // //     if (!groupId) {
// // //       Alert.alert(
// // //         'Error',
// // //         'Group information is not available yet.'
// // //       );

// // //       return;
// // //     }

// // //     Alert.alert(
// // //       'Delete Group',
// // //       `Delete "${targetGroupName}" group and all its tasks?`,
// // //       [
// // //         {
// // //           text: 'Cancel',
// // //           style: 'cancel',
// // //         },
// // //         {
// // //           text: 'Delete',
// // //           style: 'destructive',
// // //           onPress: async () => {
// // //             try {
// // //               setLoading(true);

// // //               await apiFetch(
// // //                 `/Task/groups/${groupId}`,
// // //                 {
// // //                   method: 'DELETE',
// // //                 }
// // //               );

// // //               Alert.alert(
// // //                 'Deleted',
// // //                 `"${targetGroupName}" group deleted successfully.`,
// // //                 [
// // //                   {
// // //                     text: 'OK',
// // //                     onPress: () =>
// // //                       navigation.navigate(
// // //                         'HomeDashboard'
// // //                       ),
// // //                   },
// // //                 ]
// // //               );
// // //             } catch (error) {
// // //               console.log(
// // //                 'Delete Group Error:',
// // //                 error
// // //               );

// // //               if (
// // //                 error?.message !== 'Authentication required' &&
// // //                 error?.message !== 'Session expired'
// // //               ) {
// // //                 Alert.alert(
// // //                   'Error',
// // //                   error?.message ||
// // //                     'Failed to delete group.'
// // //                 );
// // //               }
// // //             } finally {
// // //               setLoading(false);
// // //             }
// // //           },
// // //         },
// // //       ]
// // //     );
// // //   };

// // //   const handleCategory = category => {
// // //     if (category === 'SELF') {
// // //       navigation.navigate('HomeDashboard');
// // //       return;
// // //     }

// // //     if (category === targetGroupName) {
// // //       return;
// // //     }

// // //     navigation.replace(
// // //       'GroupDashboard',
// // //       {
// // //         groupName: category,
// // //       }
// // //     );
// // //   };

// // //   const handleAddTask = () => {
// // //     if (!groupId) {
// // //       Alert.alert(
// // //         'Please wait',
// // //         'Group information is still loading.'
// // //       );

// // //       return;
// // //     }

// // //     if (selectedMode === 'time') {
// // //       navigation.navigate(
// // //         'AddTaskTimeBased',
// // //         {
// // //           groupId: groupId,
// // //         }
// // //       );
// // //     } else {
// // //       navigation.navigate(
// // //         'AddTaskNonTimeBased',
// // //         {
// // //           groupId: groupId,
// // //         }
// // //       );
// // //     }
// // //   };

// // //   const handleEdit = task => {
// // //     if (selectedMode === 'time') {
// // //       navigation.navigate(
// // //         'EditTaskTimeBased',
// // //         {
// // //           task,
// // //         }
// // //       );
// // //     } else {
// // //       navigation.navigate(
// // //         'EditTaskNonTimeBased',
// // //         {
// // //           task,
// // //         }
// // //       );
// // //     }
// // //   };

// // //   const handleOpenMembers = () => {
// // //     if (!groupId) {
// // //       Alert.alert(
// // //         'Please wait',
// // //         'Group information is still loading.'
// // //       );

// // //       return;
// // //     }

// // //     navigation.navigate(
// // //       'GroupMembersScreen',
// // //       {
// // //         groupId: groupId,
// // //         groupName: targetGroupName,
// // //       }
// // //     );
// // //   };

// // //   const statusBarHeight =
// // //     StatusBar.currentHeight || 0;

// // //   const primaryAccent = '#0066FF';

// // //   return (
// // //     <SafeAreaView
// // //       style={[
// // //         styles.container,
// // //         {
// // //           backgroundColor:
// // //             theme.bg || '#F4F6F9',
// // //         },
// // //       ]}
// // //     >
// // //       <StatusBar
// // //         barStyle={
// // //           isDark
// // //             ? 'light-content'
// // //             : 'dark-content'
// // //         }
// // //         backgroundColor={
// // //           theme.bg || '#F4F6F9'
// // //         }
// // //         translucent
// // //       />

// // //       <View
// // //         style={{
// // //           height:
// // //             Platform.OS === 'android'
// // //               ? statusBarHeight
// // //               : 0,
// // //         }}
// // //       />

// // //       <View style={styles.header}>
// // //         <TouchableOpacity
// // //           style={styles.iconIconButton}
// // //           onPress={() => navigation.goBack()}
// // //           hitSlop={{
// // //             top: 10,
// // //             bottom: 10,
// // //             left: 10,
// // //             right: 10,
// // //           }}
// // //         >
// // //           <Icon
// // //             name="chevron-back"
// // //             size={24}
// // //             color={theme.text}
// // //           />
// // //         </TouchableOpacity>

// // //         <View
// // //           style={[
// // //             styles.headerBox,
// // //             {
// // //               backgroundColor: isDark
// // //                 ? '#2C2C2E'
// // //                 : '#FFFFFF',
// // //             },
// // //           ]}
// // //         >
// // //           <Text
// // //             style={[
// // //               styles.headerText,
// // //               { color: theme.text },
// // //             ]}
// // //           >
// // //             TO-DO LIST
// // //           </Text>
// // //         </View>

// // //         <View style={styles.headerActions}>
// // //           <TouchableOpacity
// // //             style={styles.iconIconButton}
// // //             onPress={handleDeleteGroup}
// // //             disabled={!groupId || loading}
// // //             hitSlop={{
// // //               top: 10,
// // //               bottom: 10,
// // //               left: 10,
// // //               right: 10,
// // //             }}
// // //           >
// // //             <Icon
// // //               name="trash-outline"
// // //               size={20}
// // //               color={
// // //                 !groupId || loading
// // //                   ? '#A0A0A0'
// // //                   : '#FF3B30'
// // //               }
// // //             />
// // //           </TouchableOpacity>

// // //           <TouchableOpacity
// // //             style={styles.iconIconButton}
// // //             onPress={() =>
// // //               navigation.navigate(
// // //                 'NotificationScreen'
// // //               )
// // //             }
// // //             hitSlop={{
// // //               top: 10,
// // //               bottom: 10,
// // //               left: 10,
// // //               right: 10,
// // //             }}
// // //           >
// // //             <Icon
// // //               name="notifications-outline"
// // //               size={22}
// // //               color={theme.text}
// // //             />
// // //           </TouchableOpacity>
// // //         </View>
// // //       </View>

// // //       <ScrollView
// // //         contentContainerStyle={
// // //           styles.scrollContainer
// // //         }
// // //         showsVerticalScrollIndicator={false}
// // //       >
// // //         <View
// // //           style={[
// // //             styles.tabContainer,
// // //             {
// // //               backgroundColor: isDark
// // //                 ? '#1C1C1E'
// // //                 : '#EAECEF',
// // //             },
// // //           ]}
// // //         >
// // //           {tabs.map(tab => {
// // //             const isActive =
// // //               selectedTab === tab;

// // //             return (
// // //               <TouchableOpacity
// // //                 key={tab}
// // //                 style={[
// // //                   styles.tab,
// // //                   isActive && [
// // //                     styles.activeTab,
// // //                     {
// // //                       backgroundColor:
// // //                         isDark
// // //                           ? '#2C2C2E'
// // //                           : '#FFFFFF',
// // //                     },
// // //                   ],
// // //                 ]}
// // //                 onPress={() =>
// // //                   setSelectedTab(tab)
// // //                 }
// // //                 activeOpacity={0.7}
// // //               >
// // //                 <Text
// // //                   style={[
// // //                     styles.tabText,
// // //                     {
// // //                       color: isActive
// // //                         ? primaryAccent
// // //                         : isDark
// // //                         ? '#A0A0A0'
// // //                         : '#666666',
// // //                       fontWeight: isActive
// // //                         ? '700'
// // //                         : '500',
// // //                     },
// // //                   ]}
// // //                 >
// // //                   {tab}
// // //                 </Text>
// // //               </TouchableOpacity>
// // //             );
// // //           })}
// // //         </View>

// // //         <View
// // //           style={[
// // //             styles.toggleBox,
// // //             {
// // //               backgroundColor: isDark
// // //                 ? '#2C2C2E'
// // //                 : '#FFFFFF',
// // //             },
// // //           ]}
// // //         >
// // //           <TouchableOpacity
// // //             style={styles.toggleItem}
// // //             onPress={() =>
// // //               setSelectedMode('time')
// // //             }
// // //             activeOpacity={0.8}
// // //           >
// // //             <View
// // //               style={[
// // //                 styles.radioOuter,
// // //                 {
// // //                   borderColor:
// // //                     selectedMode === 'time'
// // //                       ? primaryAccent
// // //                       : isDark
// // //                       ? '#555'
// // //                       : '#CCC',
// // //                 },
// // //               ]}
// // //             >
// // //               {selectedMode === 'time' && (
// // //                 <View
// // //                   style={[
// // //                     styles.radioInner,
// // //                     {
// // //                       backgroundColor:
// // //                         primaryAccent,
// // //                     },
// // //                   ]}
// // //                 />
// // //               )}
// // //             </View>

// // //             <Text
// // //               style={[
// // //                 styles.toggleText,
// // //                 {
// // //                   color: theme.text,
// // //                   fontWeight:
// // //                     selectedMode === 'time'
// // //                       ? '700'
// // //                       : '400',
// // //                 },
// // //               ]}
// // //             >
// // //               Time Based
// // //             </Text>
// // //           </TouchableOpacity>

// // //           <View
// // //             style={styles.toggleDivider}
// // //           />

// // //           <TouchableOpacity
// // //             style={styles.toggleItem}
// // //             onPress={() =>
// // //               setSelectedMode('non')
// // //             }
// // //             activeOpacity={0.8}
// // //           >
// // //             <View
// // //               style={[
// // //                 styles.radioOuter,
// // //                 {
// // //                   borderColor:
// // //                     selectedMode === 'non'
// // //                       ? primaryAccent
// // //                       : isDark
// // //                       ? '#555'
// // //                       : '#CCC',
// // //                 },
// // //               ]}
// // //             >
// // //               {selectedMode === 'non' && (
// // //                 <View
// // //                   style={[
// // //                     styles.radioInner,
// // //                     {
// // //                       backgroundColor:
// // //                         primaryAccent,
// // //                     },
// // //                   ]}
// // //                 />
// // //               )}
// // //             </View>

// // //             <Text
// // //               style={[
// // //                 styles.toggleText,
// // //                 {
// // //                   color: theme.text,
// // //                   fontWeight:
// // //                     selectedMode === 'non'
// // //                       ? '700'
// // //                       : '400',
// // //                 },
// // //               ]}
// // //             >
// // //               Non-Time Based
// // //             </Text>
// // //           </TouchableOpacity>
// // //         </View>

// // //         {/* GROUP MEMBERS CARD */}

// // //         <TouchableOpacity
// // //           style={[
// // //             styles.memberCountCard,
// // //             {
// // //               backgroundColor:
// // //                 theme.card ||
// // //                 (isDark
// // //                   ? '#1C1C1E'
// // //                   : '#FFFFFF'),
// // //             },
// // //           ]}
// // //           onPress={handleOpenMembers}
// // //           activeOpacity={0.8}
// // //           disabled={!groupId}
// // //         >
// // //           <View style={styles.memberCountIcon}>
// // //             <Icon
// // //               name="people"
// // //               size={22}
// // //               color="#FFFFFF"
// // //             />
// // //           </View>

// // //           <View style={styles.memberCountInfo}>
// // //             <Text
// // //               style={[
// // //                 styles.memberCountTitle,
// // //                 {
// // //                   color: theme.text,
// // //                 },
// // //               ]}
// // //             >
// // //               Group Members
// // //             </Text>

// // //             <Text
// // //               style={[
// // //                 styles.memberCountSubtitle,
// // //                 {
// // //                   color: theme.text,
// // //                 },
// // //               ]}
// // //             >
// // //               Tap to view all members
// // //             </Text>
// // //           </View>

// // //           <View
// // //             style={styles.memberCountNumber}
// // //           >
// // //             <Text
// // //               style={
// // //                 styles.memberCountNumberText
// // //               }
// // //             >
// // //               {memberCount}
// // //             </Text>
// // //           </View>

// // //           <Icon
// // //             name="chevron-forward"
// // //             size={20}
// // //             color={theme.text}
// // //           />
// // //         </TouchableOpacity>

// // //         {/* GROUP HEADER */}

// // //         <View style={styles.sectionHeader}>
// // //           <Text
// // //             style={[
// // //               styles.sectionTitle,
// // //               { color: theme.text },
// // //             ]}
// // //           >
// // //             {targetGroupName}
// // //           </Text>

// // //           <View style={styles.badgeCount}>
// // //             <Text
// // //               style={styles.badgeCountText}
// // //             >
// // //               {tasks.length}
// // //             </Text>
// // //           </View>
// // //         </View>

// // //         {loading ? (
// // //           <View
// // //             style={styles.loaderContainer}
// // //           >
// // //             <ActivityIndicator
// // //               size="large"
// // //               color={primaryAccent}
// // //             />
// // //           </View>
// // //         ) : tasks.length === 0 ? (
// // //           <View
// // //             style={styles.emptyContainer}
// // //           >
// // //             <Icon
// // //               name="clipboard-outline"
// // //               size={48}
// // //               color={
// // //                 isDark
// // //                   ? '#444'
// // //                   : '#CCC'
// // //               }
// // //             />

// // //             <Text
// // //               style={[
// // //                 styles.noTasksText,
// // //                 {
// // //                   color: isDark
// // //                     ? '#888'
// // //                     : '#888888',
// // //                 },
// // //               ]}
// // //             >
// // //               No tasks found for this view.
// // //             </Text>
// // //           </View>
// // //         ) : (
// // //           tasks.map(task => {
// // //             const isCompleted =
// // //               task.isCompleted === true ||
// // //               task.status === 'Done' ||
// // //               task.status === 'Completed';

// // //             return (
// // //               <TouchableOpacity
// // //                 key={String(task.id)}
// // //                 style={[
// // //                   styles.card,
// // //                   {
// // //                     backgroundColor:
// // //                       theme.card ||
// // //                       (isDark
// // //                         ? '#1C1C1E'
// // //                         : '#FFFFFF'),
// // //                   },
// // //                   isCompleted &&
// // //                     styles.completedCard,
// // //                 ]}
// // //                 activeOpacity={0.85}
// // //                 onPress={() =>
// // //                   navigation.navigate(
// // //                     'TaskGroupOverviewScreen',
// // //                     {
// // //                       task,
// // //                     }
// // //                   )
// // //                 }
// // //               >
// // //                 <View style={styles.cardLeft}>
// // //                   <View
// // //                     style={[
// // //                       styles.clock,
// // //                       {
// // //                         backgroundColor:
// // //                           isCompleted
// // //                             ? '#E8F5E9'
// // //                             : isDark
// // //                             ? '#2C2C2E'
// // //                             : '#F0F4F8',

// // //                         borderColor:
// // //                           isCompleted
// // //                             ? '#34C759'
// // //                             : primaryAccent,
// // //                       },
// // //                     ]}
// // //                   >
// // //                     <Icon
// // //                       name={
// // //                         isCompleted
// // //                           ? 'checkmark-circle'
// // //                           : 'time-outline'
// // //                       }
// // //                       size={20}
// // //                       color={
// // //                         isCompleted
// // //                           ? '#34C759'
// // //                           : primaryAccent
// // //                       }
// // //                     />
// // //                   </View>

// // //                   <View
// // //                     style={styles.taskInfo}
// // //                   >
// // //                     <Text
// // //                       style={[
// // //                         styles.taskTitle,
// // //                         {
// // //                           color:
// // //                             theme.text,
// // //                         },
// // //                         isCompleted &&
// // //                           styles.completedText,
// // //                       ]}
// // //                       numberOfLines={1}
// // //                     >
// // //                       {task.title}
// // //                     </Text>

// // //                     <Text
// // //                       style={[
// // //                         styles.taskDate,
// // //                         {
// // //                           color: isDark
// // //                             ? '#AAA'
// // //                             : '#777777',
// // //                         },
// // //                       ]}
// // //                     >
// // //                       {task.dueDate
// // //                         ? `${task.dueDate} ${
// // //                             task.dueTime || ''
// // //                           }`
// // //                         : 'No Due Date'}
// // //                     </Text>

// // //                     {isCompleted && (
// // //                       <Text
// // //                         style={
// // //                           styles.completedBadge
// // //                         }
// // //                       >
// // //                         ✓ Completed
// // //                       </Text>
// // //                     )}
// // //                   </View>
// // //                 </View>

// // //                 <View
// // //                   style={styles.taskActions}
// // //                 >
// // //                   <TouchableOpacity
// // //                     style={styles.actionBtn}
// // //                     onPress={event => {
// // //                       event.stopPropagation?.();
// // //                       handleEdit(task);
// // //                     }}
// // //                     disabled={loading}
// // //                     hitSlop={{
// // //                       top: 8,
// // //                       bottom: 8,
// // //                       left: 8,
// // //                       right: 8,
// // //                     }}
// // //                   >
// // //                     <Icon
// // //                       name="create-outline"
// // //                       size={18}
// // //                       color={
// // //                         loading
// // //                           ? '#AAA'
// // //                           : isDark
// // //                           ? '#CCC'
// // //                           : '#555'
// // //                       }
// // //                     />
// // //                   </TouchableOpacity>

// // //                   <TouchableOpacity
// // //                     style={styles.actionBtn}
// // //                     onPress={event => {
// // //                       event.stopPropagation?.();
// // //                       handleDeleteTask(
// // //                         task.id
// // //                       );
// // //                     }}
// // //                     disabled={loading}
// // //                     hitSlop={{
// // //                       top: 8,
// // //                       bottom: 8,
// // //                       left: 8,
// // //                       right: 8,
// // //                     }}
// // //                   >
// // //                     <Icon
// // //                       name="trash-outline"
// // //                       size={18}
// // //                       color={
// // //                         loading
// // //                           ? '#AAA'
// // //                           : '#FF3B30'
// // //                       }
// // //                     />
// // //                   </TouchableOpacity>

// // //                   <TouchableOpacity
// // //                     style={[
// // //                       styles.checkbox,
// // //                       {
// // //                         borderColor:
// // //                           isCompleted
// // //                             ? '#34C759'
// // //                             : primaryAccent,
// // //                       },
// // //                       isCompleted &&
// // //                         styles.checkboxDone,
// // //                     ]}
// // //                     onPress={event => {
// // //                       event.stopPropagation?.();

// // //                       if (!isCompleted) {
// // //                         handleMarkDone(task);
// // //                       }
// // //                     }}
// // //                     disabled={
// // //                       isCompleted ||
// // //                       loading
// // //                     }
// // //                     hitSlop={{
// // //                       top: 6,
// // //                       bottom: 6,
// // //                       left: 6,
// // //                       right: 6,
// // //                     }}
// // //                   >
// // //                     {isCompleted && (
// // //                       <Icon
// // //                         name="checkmark"
// // //                         size={12}
// // //                         color="#FFFFFF"
// // //                       />
// // //                     )}
// // //                   </TouchableOpacity>
// // //                 </View>
// // //               </TouchableOpacity>
// // //             );
// // //           })
// // //         )}
// // //       </ScrollView>

// // //       {/* FAB */}

// // //       <TouchableOpacity
// // //         style={[
// // //           styles.fab,
// // //           {
// // //             backgroundColor:
// // //               primaryAccent,
// // //           },
// // //           (!groupId || loading) &&
// // //             styles.fabDisabled,
// // //         ]}
// // //         onPress={handleAddTask}
// // //         disabled={!groupId || loading}
// // //         activeOpacity={0.85}
// // //       >
// // //         {loading ? (
// // //           <ActivityIndicator
// // //             size="small"
// // //             color="#FFFFFF"
// // //           />
// // //         ) : (
// // //           <Icon
// // //             name="add"
// // //             size={30}
// // //             color="#FFFFFF"
// // //           />
// // //         )}
// // //       </TouchableOpacity>

// // //       {/* CATEGORY + BOTTOM NAVIGATION */}

// // //       <View
// // //         style={styles.bottomSectionWrapper}
// // //       >
// // //         <View
// // //           style={styles.categoryContainer}
// // //         >
// // //           <ScrollView
// // //             horizontal
// // //             showsHorizontalScrollIndicator={
// // //               false
// // //             }
// // //             contentContainerStyle={
// // //               styles.categoryScrollContent
// // //             }
// // //           >
// // //             {categories.map(category => {
// // //               const isSelected =
// // //                 category ===
// // //                   targetGroupName ||
// // //                 (category === 'SELF' &&
// // //                   targetGroupName ===
// // //                     'SELF');

// // //               return (
// // //                 <TouchableOpacity
// // //                   key={category}
// // //                   style={[
// // //                     styles.categoryChip,
// // //                     {
// // //                       backgroundColor:
// // //                         isSelected
// // //                           ? primaryAccent
// // //                           : isDark
// // //                           ? '#2C2C2E'
// // //                           : '#E8ECEF',
// // //                     },
// // //                   ]}
// // //                   onPress={() =>
// // //                     handleCategory(
// // //                       category
// // //                     )
// // //                   }
// // //                   activeOpacity={0.7}
// // //                 >
// // //                   <Text
// // //                     style={[
// // //                       styles.categoryText,
// // //                       {
// // //                         color:
// // //                           isSelected
// // //                             ? '#FFFFFF'
// // //                             : isDark
// // //                             ? '#DDD'
// // //                             : '#444444',
// // //                       },
// // //                     ]}
// // //                   >
// // //                     {category}
// // //                   </Text>
// // //                 </TouchableOpacity>
// // //               );
// // //             })}

// // //             <TouchableOpacity
// // //               style={[
// // //                 styles.smallAdd,
// // //                 {
// // //                   backgroundColor:
// // //                     isDark
// // //                       ? '#333336'
// // //                       : '#E2E8F0',
// // //                 },
// // //               ]}
// // //               onPress={() =>
// // //                 navigation.navigate(
// // //                   'CreateGroup'
// // //                 )
// // //               }
// // //               activeOpacity={0.7}
// // //             >
// // //               <Icon
// // //                 name="add"
// // //                 size={18}
// // //                 color={theme.text}
// // //               />
// // //             </TouchableOpacity>
// // //           </ScrollView>
// // //         </View>

// // //         <View
// // //           style={[
// // //             styles.bottom,
// // //             {
// // //               backgroundColor:
// // //                 theme.bottomNav ||
// // //                 (isDark
// // //                   ? '#1C1C1E'
// // //                   : '#1E293B'),
// // //             },
// // //           ]}
// // //         >
// // //           <TouchableOpacity
// // //             style={styles.iconBtn}
// // //             onPress={() =>
// // //               navigation.navigate(
// // //                 'HomeDashboard'
// // //               )
// // //             }
// // //             activeOpacity={0.7}
// // //           >
// // //             <Icon
// // //               name="home-outline"
// // //               size={22}
// // //               color="#FFFFFF"
// // //             />
// // //             <Text
// // //               style={styles.navLabel}
// // //             >
// // //               Home
// // //             </Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity
// // //             style={styles.iconBtn}
// // //             onPress={() =>
// // //               navigation.navigate(
// // //                 'ContactScreen'
// // //               )
// // //             }
// // //             activeOpacity={0.7}
// // //           >
// // //             <Icon
// // //               name="people-outline"
// // //               size={22}
// // //               color="#FFFFFF"
// // //             />
// // //             <Text
// // //               style={styles.navLabel}
// // //             >
// // //               Contacts
// // //             </Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity
// // //             style={styles.iconBtn}
// // //             onPress={() =>
// // //               navigation.navigate(
// // //                 'TimeBasedHistoryScreen'
// // //               )
// // //             }
// // //             activeOpacity={0.7}
// // //           >
// // //             <Icon
// // //               name="time-outline"
// // //               size={22}
// // //               color="#FFFFFF"
// // //             />
// // //             <Text
// // //               style={styles.navLabel}
// // //             >
// // //               History
// // //             </Text>
// // //           </TouchableOpacity>

// // //           <TouchableOpacity
// // //             style={styles.iconBtn}
// // //             onPress={() =>
// // //               navigation.navigate(
// // //                 'SettingScreen'
// // //               )
// // //             }
// // //             activeOpacity={0.7}
// // //           >
// // //             <Icon
// // //               name="settings-outline"
// // //               size={22}
// // //               color="#FFFFFF"
// // //             />
// // //             <Text
// // //               style={styles.navLabel}
// // //             >
// // //               Settings
// // //             </Text>
// // //           </TouchableOpacity>
// // //         </View>
// // //       </View>
// // //     </SafeAreaView>
// // //   );
// // // };

// // // export default GroupDashboard;

// // // const styles = StyleSheet.create({
// // //   container: {
// // //     flex: 1,
// // //   },

// // //   scrollContainer: {
// // //     paddingHorizontal: 16,
// // //     paddingTop: 8,
// // //     paddingBottom: 160,
// // //   },

// // //   header: {
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     alignItems: 'center',
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 12,
// // //   },

// // //   iconIconButton: {
// // //     padding: 6,
// // //     borderRadius: 8,
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //   },

// // //   headerBox: {
// // //     paddingHorizontal: 16,
// // //     paddingVertical: 8,
// // //     borderRadius: 20,
// // //     shadowColor: '#000',
// // //     shadowOffset: {
// // //       width: 0,
// // //       height: 2,
// // //     },
// // //     shadowOpacity: 0.05,
// // //     shadowRadius: 4,
// // //     elevation: 2,
// // //   },

// // //   headerText: {
// // //     fontSize: 14,
// // //     fontWeight: '800',
// // //     letterSpacing: 1.2,
// // //   },

// // //   headerActions: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     gap: 8,
// // //   },

// // //   tabContainer: {
// // //     flexDirection: 'row',
// // //     padding: 4,
// // //     borderRadius: 14,
// // //     marginVertical: 12,
// // //   },

// // //   tab: {
// // //     flex: 1,
// // //     paddingVertical: 8,
// // //     borderRadius: 10,
// // //     alignItems: 'center',
// // //     justifyContent: 'center',
// // //   },

// // //   activeTab: {
// // //     shadowColor: '#000',
// // //     shadowOffset: {
// // //       width: 0,
// // //       height: 1,
// // //     },
// // //     shadowOpacity: 0.1,
// // //     shadowRadius: 2,
// // //     elevation: 2,
// // //   },

// // //   tabText: {
// // //     fontSize: 11,
// // //     letterSpacing: 0.2,
// // //   },

// // //   toggleBox: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     justifyContent: 'space-around',
// // //     borderRadius: 14,
// // //     paddingVertical: 12,
// // //     paddingHorizontal: 16,
// // //     marginBottom: 10,
// // //     shadowColor: '#000',
// // //     shadowOffset: {
// // //       width: 0,
// // //       height: 2,
// // //     },
// // //     shadowOpacity: 0.04,
// // //     shadowRadius: 6,
// // //     elevation: 1,
// // //   },

// // //   toggleItem: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     paddingVertical: 2,
// // //   },

// // //   toggleDivider: {
// // //     width: 1,
// // //     height: 18,
// // //     backgroundColor: '#E0E0E0',
// // //   },

// // //   toggleText: {
// // //     fontSize: 13,
// // //   },

// // //   radioOuter: {
// // //     width: 18,
// // //     height: 18,
// // //     borderRadius: 9,
// // //     borderWidth: 2,
// // //     marginRight: 8,
// // //     alignItems: 'center',
// // //     justifyContent: 'center',
// // //   },

// // //   radioInner: {
// // //     width: 8,
// // //     height: 8,
// // //     borderRadius: 4,
// // //   },

// // //   // ==========================================================
// // //   // GROUP MEMBERS
// // //   // ==========================================================

// // //   memberCountCard: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     marginHorizontal: 0,
// // //     marginTop: 6,
// // //     marginBottom: 14,
// // //     padding: 13,
// // //     borderRadius: 14,
// // //     elevation: 2,
// // //     shadowColor: '#000',
// // //     shadowOpacity: 0.08,
// // //     shadowRadius: 4,
// // //     shadowOffset: {
// // //       width: 0,
// // //       height: 2,
// // //     },
// // //   },

// // //   memberCountIcon: {
// // //     width: 45,
// // //     height: 45,
// // //     borderRadius: 23,
// // //     backgroundColor: '#6ED3E8',
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     marginRight: 12,
// // //   },

// // //   memberCountInfo: {
// // //     flex: 1,
// // //   },

// // //   memberCountTitle: {
// // //     fontSize: 16,
// // //     fontWeight: '700',
// // //   },

// // //   memberCountSubtitle: {
// // //     fontSize: 12,
// // //     opacity: 0.65,
// // //     marginTop: 2,
// // //   },

// // //   memberCountNumber: {
// // //     minWidth: 35,
// // //     height: 35,
// // //     borderRadius: 18,
// // //     backgroundColor: '#6ED3E8',
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     marginRight: 8,
// // //   },

// // //   memberCountNumberText: {
// // //     color: '#FFFFFF',
// // //     fontSize: 14,
// // //     fontWeight: '800',
// // //   },

// // //   sectionHeader: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     marginBottom: 12,
// // //     marginTop: 4,
// // //   },

// // //   sectionTitle: {
// // //     fontSize: 16,
// // //     fontWeight: '800',
// // //     letterSpacing: 0.5,
// // //   },

// // //   badgeCount: {
// // //     backgroundColor: '#0066FF20',
// // //     paddingHorizontal: 8,
// // //     paddingVertical: 2,
// // //     borderRadius: 10,
// // //     marginLeft: 8,
// // //   },

// // //   badgeCountText: {
// // //     fontSize: 12,
// // //     fontWeight: '700',
// // //     color: '#0066FF',
// // //   },

// // //   loaderContainer: {
// // //     paddingVertical: 40,
// // //     alignItems: 'center',
// // //   },

// // //   emptyContainer: {
// // //     alignItems: 'center',
// // //     justifyContent: 'center',
// // //     paddingVertical: 48,
// // //   },

// // //   noTasksText: {
// // //     marginTop: 12,
// // //     fontSize: 14,
// // //     fontWeight: '500',
// // //   },

// // //   card: {
// // //     borderRadius: 16,
// // //     padding: 14,
// // //     marginBottom: 10,
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-between',
// // //     alignItems: 'center',
// // //     shadowColor: '#000',
// // //     shadowOffset: {
// // //       width: 0,
// // //       height: 2,
// // //     },
// // //     shadowOpacity: 0.05,
// // //     shadowRadius: 5,
// // //     elevation: 2,
// // //   },

// // //   completedCard: {
// // //     opacity: 0.65,
// // //     borderLeftWidth: 4,
// // //     borderLeftColor: '#34C759',
// // //   },

// // //   cardLeft: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     flex: 1,
// // //     marginRight: 8,
// // //   },

// // //   clock: {
// // //     width: 38,
// // //     height: 38,
// // //     borderRadius: 12,
// // //     borderWidth: 1.5,
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     marginRight: 12,
// // //   },

// // //   taskInfo: {
// // //     flex: 1,
// // //   },

// // //   taskTitle: {
// // //     fontSize: 14,
// // //     fontWeight: '700',
// // //     lineHeight: 18,
// // //   },

// // //   taskDate: {
// // //     fontSize: 11,
// // //     marginTop: 3,
// // //     fontWeight: '500',
// // //   },

// // //   completedText: {
// // //     textDecorationLine: 'line-through',
// // //   },

// // //   completedBadge: {
// // //     fontSize: 10,
// // //     color: '#34C759',
// // //     fontWeight: '700',
// // //     marginTop: 3,
// // //   },

// // //   taskActions: {
// // //     flexDirection: 'row',
// // //     alignItems: 'center',
// // //     gap: 8,
// // //   },

// // //   actionBtn: {
// // //     padding: 6,
// // //     borderRadius: 8,
// // //   },

// // //   checkbox: {
// // //     width: 22,
// // //     height: 22,
// // //     borderWidth: 2,
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     borderRadius: 6,
// // //     marginLeft: 4,
// // //   },

// // //   checkboxDone: {
// // //     backgroundColor: '#34C759',
// // //     borderColor: '#34C759',
// // //   },

// // //   fab: {
// // //     position: 'absolute',
// // //     right: 20,
// // //     bottom: 128,
// // //     width: 56,
// // //     height: 56,
// // //     borderRadius: 28,
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //     shadowColor: '#0066FF',
// // //     shadowOffset: {
// // //       width: 0,
// // //       height: 4,
// // //     },
// // //     shadowOpacity: 0.3,
// // //     shadowRadius: 8,
// // //     elevation: 6,
// // //     zIndex: 99,
// // //   },

// // //   fabDisabled: {
// // //     opacity: 0.5,
// // //   },

// // //   bottomSectionWrapper: {
// // //     position: 'absolute',
// // //     bottom: 0,
// // //     left: 0,
// // //     right: 0,
// // //     width: SCREEN_WIDTH,
// // //   },

// // //   categoryContainer: {
// // //     paddingVertical: 10,
// // //     backgroundColor: 'transparent',
// // //   },

// // //   categoryScrollContent: {
// // //     paddingHorizontal: 16,
// // //     alignItems: 'center',
// // //   },

// // //   categoryChip: {
// // //     paddingVertical: 8,
// // //     paddingHorizontal: 16,
// // //     borderRadius: 20,
// // //     marginRight: 8,
// // //   },

// // //   categoryText: {
// // //     fontSize: 12,
// // //     fontWeight: '700',
// // //   },

// // //   smallAdd: {
// // //     width: 32,
// // //     height: 32,
// // //     borderRadius: 16,
// // //     justifyContent: 'center',
// // //     alignItems: 'center',
// // //   },

// // //   bottom: {
// // //     width: '100%',
// // //     height: 60,
// // //     flexDirection: 'row',
// // //     justifyContent: 'space-around',
// // //     alignItems: 'center',
// // //     borderTopLeftRadius: 18,
// // //     borderTopRightRadius: 18,
// // //     paddingHorizontal: 8,
// // //   },

// // //   iconBtn: {
// // //     flex: 1,
// // //     alignItems: 'center',
// // //     justifyContent: 'center',
// // //     paddingVertical: 4,
// // //   },

// // //   navLabel: {
// // //     color: '#FFFFFF',
// // //     fontSize: 10,
// // //     marginTop: 2,
// // //     fontWeight: '500',
// // //   },
// // // });


























































// // // // import React, { useState, useCallback } from 'react';
// // // // import {
// // // //   View,
// // // //   Text,
// // // //   StyleSheet,
// // // //   SafeAreaView,
// // // //   TouchableOpacity,
// // // //   ScrollView,
// // // //   ActivityIndicator,
// // // //   Alert,
// // // //   StatusBar,
// // // //   Platform,
// // // //   Dimensions,
// // // // } from 'react-native';

// // // // import Icon from '@react-native-vector-icons/ionicons';
// // // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // // import { useTheme } from '../../context/ThemeContext';
// // // // import { useFocusEffect } from '@react-navigation/native';
// // // // import { BASE_URL } from '../../config/api';

// // // // const { width: SCREEN_WIDTH } = Dimensions.get('window');

// // // // // ============================================================
// // // // // GO TO LOGIN
// // // // // AuthStack -> Login
// // // // // ============================================================
// // // // const goToLogin = navigation => {
// // // //   navigation.reset({
// // // //     index: 0,
// // // //     routes: [
// // // //       {
// // // //         name: 'AuthStack',
// // // //         state: {
// // // //           routes: [{ name: 'Login' }],
// // // //         },
// // // //       },
// // // //     ],
// // // //   });
// // // // };

// // // // // ============================================================
// // // // // GROUP DASHBOARD
// // // // // ============================================================
// // // // const GroupDashboard = ({ navigation, route }) => {
// // // //   const { isDark, theme } = useTheme();

// // // //   // Group name received from HomeDashboard
// // // //   const targetGroupName = (
// // // //     route?.params?.groupName || ''
// // // //   ).toUpperCase();

// // // //   const [selectedTab, setSelectedTab] = useState('ALL');
// // // //   const [selectedMode, setSelectedMode] = useState('time');

// // // //   const [tasks, setTasks] = useState([]);
// // // //   const [loading, setLoading] = useState(false);

// // // //   const [groupId, setGroupId] = useState(null);
// // // //   const [allGroupNames, setAllGroupNames] = useState([]);
// // // //   const [memberCount, setMemberCount] = useState(0);

// // // //   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

// // // //   // SELF + all dynamic groups
// // // //   const categories = [
// // // //     'SELF',
// // // //     ...allGroupNames.filter(
// // // //       (group, index, array) =>
// // // //         array.indexOf(group) === index
// // // //     ),
// // // //   ];

// // // //   // ============================================================
// // // //   // GET JWT TOKEN
// // // //   // ============================================================
// // // //   const getToken = async () => {
// // // //     try {
// // // //       const token = await AsyncStorage.getItem('token');

// // // //       if (!token) {
// // // //         Alert.alert(
// // // //           'Session Expired',
// // // //           'Your session has expired. Please login again.',
// // // //           [
// // // //             {
// // // //               text: 'OK',
// // // //               onPress: () => goToLogin(navigation),
// // // //             },
// // // //           ]
// // // //         );

// // // //         return null;
// // // //       }

// // // //       return token;
// // // //     } catch (error) {
// // // //       console.log('Get Token Error:', error);
// // // //       return null;
// // // //     }
// // // //   };

// // // //   // ============================================================
// // // //   // GENERIC API FETCH
// // // //   // ============================================================
// // // //   const apiFetch = async (endpoint, options = {}) => {
// // // //     const token = await getToken();

// // // //     if (!token) {
// // // //       throw new Error('Authentication required');
// // // //     }

// // // //     const response = await fetch(
// // // //       `${BASE_URL}${endpoint}`,
// // // //       {
// // // //         ...options,
// // // //         headers: {
// // // //           Accept: 'application/json',
// // // //           'Content-Type': 'application/json',
// // // //           Authorization: `Bearer ${token}`,
// // // //           ...(options.headers || {}),
// // // //         },
// // // //       }
// // // //     );

// // // //     let data = null;

// // // //     try {
// // // //       const text = await response.text();

// // // //       if (text) {
// // // //         data = JSON.parse(text);
// // // //       }
// // // //     } catch (error) {
// // // //       console.log('Response JSON Parse Error:', error);
// // // //       data = null;
// // // //     }

// // // //     console.log(
// // // //       `API ${options.method || 'GET'} ${endpoint}:`,
// // // //       response.status,
// // // //       data
// // // //     );

// // // //     if (response.status === 401) {
// // // //       await AsyncStorage.removeItem('token');

// // // //       Alert.alert(
// // // //         'Session Expired',
// // // //         'Please login again.',
// // // //         [
// // // //           {
// // // //             text: 'OK',
// // // //             onPress: () => goToLogin(navigation),
// // // //           },
// // // //         ]
// // // //       );

// // // //       throw new Error('Session expired');
// // // //     }

// // // //     if (!response.ok) {
// // // //       throw new Error(
// // // //         data?.message ||
// // // //           data?.error ||
// // // //           `Request failed with status ${response.status}`
// // // //       );
// // // //     }

// // // //     return data;
// // // //   };

// // // //   // ============================================================
// // // //   // FETCH GROUPS + GROUP TASKS
// // // //   // ============================================================
// // // //   const fetchData = useCallback(async () => {
// // // //     try {
// // // //       setLoading(true);

// // // //       const groupsResponse = await apiFetch('/Task/groups');

// // // //       console.log(
// // // //         'Fetch Groups Response:',
// // // //         groupsResponse
// // // //       );

// // // //       if (
// // // //         !groupsResponse ||
// // // //         !groupsResponse.success
// // // //       ) {
// // // //         setTasks([]);
// // // //         return;
// // // //       }

// // // //       const groups = groupsResponse.data || [];

// // // //       const names = groups
// // // //         .map(group => group?.name)
// // // //         .filter(Boolean)
// // // //         .map(name => name.toUpperCase());

// // // //       setAllGroupNames(names);

// // // //       const targetGroup = groups.find(
// // // //         group =>
// // // //           group?.name &&
// // // //           group.name.toUpperCase() ===
// // // //             targetGroupName
// // // //       );

// // // //       if (!targetGroup) {
// // // //         console.log(
// // // //           'Group not found:',
// // // //           targetGroupName
// // // //         );

// // // //         setGroupId(null);
// // // //         setTasks([]);

// // // //         return;
// // // //       }
// // // //         setGroupId(targetGroup.id);
// // // //         setMemberCount(targetGroup.memberCount || 0);

// // // //       const currentGroupId = targetGroup.id;

// // // //       setGroupId(currentGroupId);

// // // //       console.log(
// // // //         'Selected Group:',
// // // //         targetGroup.name
// // // //       );

// // // //       console.log(
// // // //         'Selected Group ID:',
// // // //         currentGroupId
// // // //       );

// // // //       const isTimeBased =
// // // //         selectedMode === 'time';

// // // //       const tabParam =
// // // //         selectedTab === 'ALL'
// // // //           ? ''
// // // //           : selectedTab.toLowerCase();

// // // //       const query =
// // // //         `/Task/group?tab=${encodeURIComponent(
// // // //           tabParam
// // // //         )}` +
// // // //         `&isTimeBased=${isTimeBased}` +
// // // //         `&groupId=${encodeURIComponent(
// // // //           currentGroupId
// // // //         )}`;

// // // //       console.log(
// // // //         'Fetching Group Tasks:',
// // // //         `${BASE_URL}${query}`
// // // //       );

// // // //       const tasksResponse = await apiFetch(
// // // //         query
// // // //       );

// // // //       console.log(
// // // //         'Fetch Group Tasks Response:',
// // // //         tasksResponse
// // // //       );

// // // //       if (
// // // //         tasksResponse?.success
// // // //       ) {
// // // //         setTasks(
// // // //           tasksResponse.data || []
// // // //         );
// // // //       } else {
// // // //         setTasks([]);
// // // //       }
// // // //     } catch (error) {
// // // //       console.log(
// // // //         'GroupDashboard fetchData Error:',
// // // //         error
// // // //       );

// // // //       if (
// // // //         error?.message !==
// // // //           'Authentication required' &&
// // // //         error?.message !==
// // // //           'Session expired'
// // // //       ) {
// // // //         Alert.alert(
// // // //           'Error',
// // // //           error?.message ||
// // // //             'Failed to load group tasks.'
// // // //         );
// // // //       }
// // // //     } finally {
// // // //       setLoading(false);
// // // //     }
// // // //   }, [
// // // //     targetGroupName,
// // // //     selectedTab,
// // // //     selectedMode,
// // // //   ]);

// // // //   // ============================================================
// // // //   // REFRESH WHEN SCREEN GETS FOCUS
// // // //   // ============================================================
// // // //   useFocusEffect(
// // // //     useCallback(() => {
// // // //       fetchData();
// // // //     }, [fetchData])
// // // //   );

// // // //   // ============================================================
// // // //   // MARK TASK AS DONE
// // // //   // ============================================================
// // // //   const handleMarkDone = async task => {
// // // //     try {
// // // //       setLoading(true);

// // // //       await apiFetch(
// // // //         `/Task/${task.id}/done`,
// // // //         {
// // // //           method: 'POST',
// // // //         }
// // // //       );

// // // //       Alert.alert(
// // // //         '✅ Task Completed!',
// // // //         `"${task.title}" has been marked as done.`
// // // //       );

// // // //       await fetchData();
// // // //     } catch (error) {
// // // //       console.log(
// // // //         'Mark Done Error:',
// // // //         error
// // // //       );

// // // //       if (
// // // //         error?.message !==
// // // //           'Authentication required' &&
// // // //         error?.message !==
// // // //           'Session expired'
// // // //       ) {
// // // //         Alert.alert(
// // // //           'Error',
// // // //           error?.message ||
// // // //             'Failed to mark task as done.'
// // // //         );
// // // //       }
// // // //     } finally {
// // // //       setLoading(false);
// // // //     }
// // // //   };

// // // //   // ============================================================
// // // //   // DELETE TASK
// // // //   // ============================================================
// // // //   const handleDeleteTask = taskId => {
// // // //     Alert.alert(
// // // //       'Delete Task',
// // // //       'Are you sure you want to delete this task?',
// // // //       [
// // // //         {
// // // //           text: 'Cancel',
// // // //           style: 'cancel',
// // // //         },
// // // //         {
// // // //           text: 'Delete',
// // // //           style: 'destructive',
// // // //           onPress: async () => {
// // // //             try {
// // // //               setLoading(true);

// // // //               await apiFetch(
// // // //                 `/Task/task/${taskId}`,
// // // //                 {
// // // //                   method: 'DELETE',
// // // //                 }
// // // //               );

// // // //               Alert.alert(
// // // //                 'Success',
// // // //                 'Task deleted successfully.'
// // // //               );

// // // //               await fetchData();
// // // //             } catch (error) {
// // // //               console.log(
// // // //                 'Delete Task Error:',
// // // //                 error
// // // //               );

// // // //               if (
// // // //                 error?.message !==
// // // //                   'Authentication required' &&
// // // //                 error?.message !==
// // // //                   'Session expired'
// // // //               ) {
// // // //                 Alert.alert(
// // // //                   'Error',
// // // //                   error?.message ||
// // // //                     'Failed to delete task.'
// // // //                 );
// // // //               }
// // // //             } finally {
// // // //               setLoading(false);
// // // //             }
// // // //           },
// // // //         },
// // // //       ]
// // // //     );
// // // //   };

// // // //   // ============================================================
// // // //   // DELETE GROUP
// // // //   // ============================================================
// // // //   const handleDeleteGroup = () => {
// // // //     if (!groupId) {
// // // //       Alert.alert(
// // // //         'Error',
// // // //         'Group information is not available yet.'
// // // //       );

// // // //       return;
// // // //     }

// // // //     Alert.alert(
// // // //       'Delete Group',
// // // //       `Delete "${targetGroupName}" group and all its tasks?`,
// // // //       [
// // // //         {
// // // //           text: 'Cancel',
// // // //           style: 'cancel',
// // // //         },
// // // //         {
// // // //           text: 'Delete',
// // // //           style: 'destructive',
// // // //           onPress: async () => {
// // // //             try {
// // // //               setLoading(true);

// // // //               await apiFetch(
// // // //                 `/Task/groups/${groupId}`,
// // // //                 {
// // // //                   method: 'DELETE',
// // // //                 }
// // // //               );

// // // //               Alert.alert(
// // // //                 'Deleted',
// // // //                 `"${targetGroupName}" group deleted successfully.`,
// // // //                 [
// // // //                   {
// // // //                     text: 'OK',
// // // //                     onPress: () =>
// // // //                       navigation.navigate(
// // // //                         'HomeDashboard'
// // // //                       ),
// // // //                   },
// // // //                 ]
// // // //               );
// // // //             } catch (error) {
// // // //               console.log(
// // // //                 'Delete Group Error:',
// // // //                 error
// // // //               );

// // // //               if (
// // // //                 error?.message !==
// // // //                   'Authentication required' &&
// // // //                 error?.message !==
// // // //                   'Session expired'
// // // //               ) {
// // // //                 Alert.alert(
// // // //                   'Error',
// // // //                   error?.message ||
// // // //                     'Failed to delete group.'
// // // //                 );
// // // //               }
// // // //             } finally {
// // // //               setLoading(false);
// // // //             }
// // // //           },
// // // //         },
// // // //       ]
// // // //     );
// // // //   };

// // // //   // ============================================================
// // // //   // CATEGORY NAVIGATION
// // // //   // ============================================================
// // // //   const handleCategory = category => {
// // // //     if (category === 'SELF') {
// // // //       navigation.navigate(
// // // //         'HomeDashboard'
// // // //       );

// // // //       return;
// // // //     }

// // // //     if (
// // // //       category === targetGroupName
// // // //     ) {
// // // //       return;
// // // //     }

// // // //     navigation.replace(
// // // //       'GroupDashboard',
// // // //       {
// // // //         groupName: category,
// // // //       }
// // // //     );
// // // //   };

// // // //   // ============================================================
// // // //   // ADD TASK
// // // //   // ============================================================
// // // //   const handleAddTask = () => {
// // // //     if (!groupId) {
// // // //       Alert.alert(
// // // //         'Please wait',
// // // //         'Group information is still loading.'
// // // //       );

// // // //       return;
// // // //     }

// // // //     if (selectedMode === 'time') {
// // // //       navigation.navigate(
// // // //         'AddTaskTimeBased',
// // // //         {
// // // //           groupId: groupId,
// // // //         }
// // // //       );
// // // //     } else {
// // // //       navigation.navigate(
// // // //         'AddTaskNonTimeBased',
// // // //         {
// // // //           groupId: groupId,
// // // //         }
// // // //       );
// // // //     }
// // // //   };

// // // //   // ============================================================
// // // //   // EDIT TASK
// // // //   // ============================================================
// // // //   const handleEdit = task => {
// // // //     if (selectedMode === 'time') {
// // // //       navigation.navigate(
// // // //         'EditTaskTimeBased',
// // // //         {
// // // //           task,
// // // //         }
// // // //       );
// // // //     } else {
// // // //       navigation.navigate(
// // // //         'EditTaskNonTimeBased',
// // // //         {
// // // //           task,
// // // //         }
// // // //       );
// // // //     }
// // // //   };

// // // //   // Dynamic status bar height calculation
// // // //   const statusBarHeight = StatusBar.currentHeight || 0;

// // // //   // Primary Accent color
// // // //   const primaryAccent = '#0066FF';

// // // //   return (
// // // //     <SafeAreaView
// // // //       style={[
// // // //         styles.container,
// // // //         {
// // // //           backgroundColor: theme.bg || '#F4F6F9',
// // // //         },
// // // //       ]}
// // // //     >
// // // //       <StatusBar
// // // //         barStyle={isDark ? 'light-content' : 'dark-content'}
// // // //         backgroundColor={theme.bg || '#F4F6F9'}
// // // //         translucent
// // // //       />

// // // //       {/* Dynamic Header Safe Spacing */}
// // // //       <View style={{ height: Platform.OS === 'android' ? statusBarHeight : 0 }} />

// // // //       {/* ======================================================
// // // //           HEADER
// // // //       ====================================================== */}
// // // //       <View style={styles.header}>
// // // //         <TouchableOpacity
// // // //           style={styles.iconIconButton}
// // // //           onPress={() => navigation.goBack()}
// // // //           hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
// // // //         >
// // // //           <Icon name="chevron-back" size={24} color={theme.text} />
// // // //         </TouchableOpacity>

// // // //         <View
// // // //           style={[
// // // //             styles.headerBox,
// // // //             {
// // // //               backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
// // // //             },
// // // //           ]}
// // // //         >
// // // //           <Text style={[styles.headerText, { color: theme.text }]}>
// // // //             TO-DO LIST
// // // //           </Text>
// // // //         </View>

// // // //         <View style={styles.headerActions}>
// // // //           <TouchableOpacity
// // // //             style={styles.iconIconButton}
// // // //             onPress={handleDeleteGroup}
// // // //             disabled={!groupId || loading}
// // // //             hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
// // // //           >
// // // //             <Icon
// // // //               name="trash-outline"
// // // //               size={20}
// // // //               color={!groupId || loading ? '#A0A0A0' : '#FF3B30'}
// // // //             />
// // // //           </TouchableOpacity>

// // // //           <TouchableOpacity
// // // //             style={styles.iconIconButton}
// // // //             onPress={() => navigation.navigate('NotificationScreen')}
// // // //             hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
// // // //           >
// // // //             <Icon name="notifications-outline" size={22} color={theme.text} />
// // // //           </TouchableOpacity>
// // // //         </View>
// // // //       </View>

// // // //       {/* ======================================================
// // // //           MAIN CONTENT
// // // //       ====================================================== */}
// // // //       <ScrollView
// // // //         contentContainerStyle={styles.scrollContainer}
// // // //         showsVerticalScrollIndicator={false}
// // // //       >
// // // //         {/* ====================================================
// // // //             TABS
// // // //         ==================================================== */}
// // // //         <View
// // // //           style={[
// // // //             styles.tabContainer,
// // // //             {
// // // //               backgroundColor: isDark ? '#1C1C1E' : '#EAECEF',
// // // //             },
// // // //           ]}
// // // //         >
// // // //           {tabs.map(tab => {
// // // //             const isActive = selectedTab === tab;
// // // //             return (
// // // //               <TouchableOpacity
// // // //                 key={tab}
// // // //                 style={[
// // // //                   styles.tab,
// // // //                   isActive && [
// // // //                     styles.activeTab,
// // // //                     { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' },
// // // //                   ],
// // // //                 ]}
// // // //                 onPress={() => setSelectedTab(tab)}
// // // //                 activeOpacity={0.7}
// // // //               >
// // // //                 <Text
// // // //                   style={[
// // // //                     styles.tabText,
// // // //                     {
// // // //                       color: isActive
// // // //                         ? primaryAccent
// // // //                         : isDark
// // // //                         ? '#A0A0A0'
// // // //                         : '#666666',
// // // //                       fontWeight: isActive ? '700' : '500',
// // // //                     },
// // // //                   ]}
// // // //                 >
// // // //                   {tab}
// // // //                 </Text>
// // // //               </TouchableOpacity>
// // // //             );
// // // //           })}
// // // //         </View>

// // // //         {/* ====================================================
// // // //             TIME / NON-TIME TOGGLE
// // // //         ==================================================== */}
// // // //         <View
// // // //           style={[
// // // //             styles.toggleBox,
// // // //             {
// // // //               backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
// // // //             },
// // // //           ]}
// // // //         >
// // // //           <TouchableOpacity
// // // //             style={styles.toggleItem}
// // // //             onPress={() => setSelectedMode('time')}
// // // //             activeOpacity={0.8}
// // // //           >
// // // //             <View
// // // //               style={[
// // // //                 styles.radioOuter,
// // // //                 {
// // // //                   borderColor:
// // // //                     selectedMode === 'time'
// // // //                       ? primaryAccent
// // // //                       : isDark
// // // //                       ? '#555'
// // // //                       : '#CCC',
// // // //                 },
// // // //               ]}
// // // //             >
// // // //               {selectedMode === 'time' && (
// // // //                 <View
// // // //                   style={[
// // // //                     styles.radioInner,
// // // //                     { backgroundColor: primaryAccent },
// // // //                   ]}
// // // //                 />
// // // //               )}
// // // //             </View>
// // // //             <Text
// // // //               style={[
// // // //                 styles.toggleText,
// // // //                 {
// // // //                   color: theme.text,
// // // //                   fontWeight: selectedMode === 'time' ? '700' : '400',
// // // //                 },
// // // //               ]}
// // // //             >
// // // //               Time Based
// // // //             </Text>
// // // //           </TouchableOpacity>

// // // //           <View style={styles.toggleDivider} />

// // // //           <TouchableOpacity
// // // //             style={styles.toggleItem}
// // // //             onPress={() => setSelectedMode('non')}
// // // //             activeOpacity={0.8}
// // // //           >
// // // //             <View
// // // //               style={[
// // // //                 styles.radioOuter,
// // // //                 {
// // // //                   borderColor:
// // // //                     selectedMode === 'non'
// // // //                       ? primaryAccent
// // // //                       : isDark
// // // //                       ? '#555'
// // // //                       : '#CCC',
// // // //                 },
// // // //               ]}
// // // //             >
// // // //               {selectedMode === 'non' && (
// // // //                 <View
// // // //                   style={[
// // // //                     styles.radioInner,
// // // //                     { backgroundColor: primaryAccent },
// // // //                   ]}
// // // //                 />
// // // //               )}
// // // //             </View>
// // // //             <Text
// // // //               style={[
// // // //                 styles.toggleText,
// // // //                 {
// // // //                   color: theme.text,
// // // //                   fontWeight: selectedMode === 'non' ? '700' : '400',
// // // //                 },
// // // //               ]}
// // // //             >
// // // //               Non-Time Based
// // // //             </Text>
// // // //           </TouchableOpacity>
// // // //         </View>

// // // //         {/* ====================================================
// // // //             GROUP HEADER TITLE
// // // //         ==================================================== */}
// // // //         <View style={styles.sectionHeader}>
// // // //           <Text style={[styles.sectionTitle, { color: theme.text }]}>
// // // //             {targetGroupName}
// // // //           </Text>
// // // //           <View style={styles.badgeCount}>
// // // //             <Text style={styles.badgeCountText}>{tasks.length}</Text>
// // // //           </View>
// // // //         </View>

// // // //         {/* ====================================================
// // // //             LOADING & TASK LIST
// // // //         ==================================================== */}
// // // //         {loading ? (
// // // //           <View style={styles.loaderContainer}>
// // // //             <ActivityIndicator size="large" color={primaryAccent} />
// // // //           </View>
// // // //         ) : tasks.length === 0 ? (
// // // //           <View style={styles.emptyContainer}>
// // // //             <Icon
// // // //               name="clipboard-outline"
// // // //               size={48}
// // // //               color={isDark ? '#444' : '#CCC'}
// // // //             />
// // // //             <Text
// // // //               style={[
// // // //                 styles.noTasksText,
// // // //                 { color: isDark ? '#888' : '#888888' },
// // // //               ]}
// // // //             >
// // // //               No tasks found for this view.
// // // //             </Text>
// // // //           </View>
// // // //         ) : (
// // // //           tasks.map(task => (
// // // //             <TouchableOpacity
// // // //               key={task.id}
// // // //               style={[
// // // //                 styles.card,
// // // //                 {
// // // //                   backgroundColor: theme.card || (isDark ? '#1C1C1E' : '#FFFFFF'),
// // // //                 },
// // // //                 task.isCompleted && styles.completedCard,
// // // //               ]}
// // // //               activeOpacity={0.85}
// // // //               onPress={() =>
// // // //                 navigation.navigate('TaskGroupOverviewScreen', {
// // // //                   task,
// // // //                 })
// // // //               }
// // // //             >
// // // //               <View style={styles.cardLeft}>
// // // //                 <View
// // // //                   style={[
// // // //                     styles.clock,
// // // //                     {
// // // //                       backgroundColor: task.isCompleted
// // // //                         ? '#E8F5E9'
// // // //                         : isDark
// // // //                         ? '#2C2C2E'
// // // //                         : '#F0F4F8',
// // // //                       borderColor: task.isCompleted
// // // //                         ? '#34C759'
// // // //                         : primaryAccent,
// // // //                     },
// // // //                   ]}
// // // //                 >
// // // //                   <Icon
// // // //                     name={task.isCompleted ? 'checkmark-circle' : 'time-outline'}
// // // //                     size={20}
// // // //                     color={task.isCompleted ? '#34C759' : primaryAccent}
// // // //                   />
// // // //                 </View>

// // // //                 <View style={styles.taskInfo}>
// // // //                   <Text
// // // //                     style={[
// // // //                       styles.taskTitle,
// // // //                       { color: theme.text },
// // // //                       task.isCompleted && styles.completedText,
// // // //                     ]}
// // // //                     numberOfLines={1}
// // // //                   >
// // // //                     {task.title}
// // // //                   </Text>

// // // //                   <Text
// // // //                     style={[
// // // //                       styles.taskDate,
// // // //                       { color: isDark ? '#AAA' : '#777777' },
// // // //                     ]}
// // // //                   >
// // // //                     {task.dueDate
// // // //                       ? `${task.dueDate} ${task.dueTime || ''}`
// // // //                       : 'No Due Date'}
// // // //                   </Text>

// // // //                   {task.isCompleted && (
// // // //                     <Text style={styles.completedBadge}>✓ Completed</Text>
// // // //                   )}
// // // //                 </View>
// // // //               </View>

// // // //               {/* ACTION BUTTONS */}
// // // //               <View style={styles.taskActions}>
// // // //                 <TouchableOpacity
// // // //                   style={styles.actionBtn}
// // // //                   onPress={event => {
// // // //                     event.stopPropagation?.();
// // // //                     handleEdit(task);
// // // //                   }}
// // // //                   disabled={loading}
// // // //                   hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
// // // //                 >
// // // //                   <Icon
// // // //                     name="create-outline"
// // // //                     size={18}
// // // //                     color={loading ? '#AAA' : isDark ? '#CCC' : '#555'}
// // // //                   />
// // // //                 </TouchableOpacity>

// // // //                 <TouchableOpacity
// // // //                   style={styles.actionBtn}
// // // //                   onPress={event => {
// // // //                     event.stopPropagation?.();
// // // //                     handleDeleteTask(task.id);
// // // //                   }}
// // // //                   disabled={loading}
// // // //                   hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
// // // //                 >
// // // //                   <Icon
// // // //                     name="trash-outline"
// // // //                     size={18}
// // // //                     color={loading ? '#AAA' : '#FF3B30'}
// // // //                   />
// // // //                 </TouchableOpacity>

// // // //                 <TouchableOpacity
// // // //                   style={[
// // // //                     styles.checkbox,
// // // //                     {
// // // //                       borderColor: task.isCompleted ? '#34C759' : primaryAccent,
// // // //                     },
// // // //                     task.isCompleted && styles.checkboxDone,
// // // //                   ]}
// // // //                   onPress={event => {
// // // //                     event.stopPropagation?.();
// // // //                     if (!task.isCompleted) {
// // // //                       handleMarkDone(task);
// // // //                     }
// // // //                   }}
// // // //                   disabled={task.isCompleted || loading}
// // // //                   hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
// // // //                 >
// // // //                   {task.isCompleted && (
// // // //                     <Icon name="checkmark" size={12} color="#FFFFFF" />
// // // //                   )}
// // // //                 </TouchableOpacity>
// // // //               </View>
// // // //             </TouchableOpacity>
// // // //           ))
// // // //         )}
// // // //       </ScrollView>

// // // //       {/* ========================================================
// // // //           FLOATING ACTION BUTTON (FAB)
// // // //       ======================================================== */}
// // // //       <TouchableOpacity
// // // //         style={[
// // // //           styles.fab,
// // // //           { backgroundColor: primaryAccent },
// // // //           (!groupId || loading) && styles.fabDisabled,
// // // //         ]}
// // // //         onPress={handleAddTask}
// // // //         disabled={!groupId || loading}
// // // //         activeOpacity={0.85}
// // // //       >
// // // //         {loading ? (
// // // //           <ActivityIndicator size="small" color="#FFFFFF" />
// // // //         ) : (
// // // //           <Icon name="add" size={30} color="#FFFFFF" />
// // // //         )}
// // // //       </TouchableOpacity>

// // // //       {/* ========================================================
// // // //           CATEGORY SLIDER & BOTTOM NAV CONTAINER
// // // //       ======================================================== */}
// // // //       <View style={styles.bottomSectionWrapper}>
// // // //         {/* CATEGORY BAR */}
// // // //         <View style={styles.categoryContainer}>
// // // //           <ScrollView
// // // //             horizontal
// // // //             showsHorizontalScrollIndicator={false}
// // // //             contentContainerStyle={styles.categoryScrollContent}
// // // //           >
// // // //             {categories.map(category => {
// // // //               const isSelected =
// // // //                 category === targetGroupName ||
// // // //                 (category === 'SELF' && targetGroupName === 'SELF');

// // // //               return (
// // // //                 <TouchableOpacity
// // // //                   key={category}
// // // //                   style={[
// // // //                     styles.categoryChip,
// // // //                     {
// // // //                       backgroundColor: isSelected
// // // //                         ? primaryAccent
// // // //                         : isDark
// // // //                         ? '#2C2C2E'
// // // //                         : '#E8ECEF',
// // // //                     },
// // // //                   ]}
// // // //                   onPress={() => handleCategory(category)}
// // // //                   activeOpacity={0.7}
// // // //                 >
// // // //                   <Text
// // // //                     style={[
// // // //                       styles.categoryText,
// // // //                       {
// // // //                         color: isSelected
// // // //                           ? '#FFFFFF'
// // // //                           : isDark
// // // //                           ? '#DDD'
// // // //                           : '#444444',
// // // //                       },
// // // //                     ]}
// // // //                   >
// // // //                     {category}
// // // //                   </Text>
// // // //                 </TouchableOpacity>
// // // //               );
// // // //             })}

// // // //             {/* ADD GROUP */}
// // // //             <TouchableOpacity
// // // //               style={[
// // // //                 styles.smallAdd,
// // // //                 { backgroundColor: isDark ? '#333336' : '#E2E8F0' },
// // // //               ]}
// // // //               onPress={() => navigation.navigate('CreateGroup')}
// // // //               activeOpacity={0.7}
// // // //             >
// // // //               <Icon name="add" size={18} color={theme.text} />
// // // //             </TouchableOpacity>
// // // //           </ScrollView>
// // // //         </View>

// // // //         {/* BOTTOM NAVIGATION */}
// // // //         <View
// // // //           style={[
// // // //             styles.bottom,
// // // //             {
// // // //               backgroundColor: theme.bottomNav || (isDark ? '#1C1C1E' : '#1E293B'),
// // // //             },
// // // //           ]}
// // // //         >
// // // //           <TouchableOpacity
// // // //             style={styles.iconBtn}
// // // //             onPress={() => navigation.navigate('HomeDashboard')}
// // // //             activeOpacity={0.7}
// // // //           >
// // // //             <Icon name="home-outline" size={22} color="#FFFFFF" />
// // // //             <Text style={styles.navLabel}>Home</Text>
// // // //           </TouchableOpacity>

// // // //           <TouchableOpacity
// // // //             style={styles.iconBtn}
// // // //             onPress={() => navigation.navigate('ContactScreen')}
// // // //             activeOpacity={0.7}
// // // //           >
// // // //             <Icon name="people-outline" size={22} color="#FFFFFF" />
// // // //             <Text style={styles.navLabel}>Contacts</Text>
// // // //           </TouchableOpacity>

// // // //           <TouchableOpacity
// // // //             style={styles.iconBtn}
// // // //             onPress={() => navigation.navigate('TimeBasedHistoryScreen')}
// // // //             activeOpacity={0.7}
// // // //           >
// // // //             <Icon name="time-outline" size={22} color="#FFFFFF" />
// // // //             <Text style={styles.navLabel}>History</Text>
// // // //           </TouchableOpacity>

// // // //           <TouchableOpacity
// // // //             style={styles.iconBtn}
// // // //             onPress={() => navigation.navigate('SettingScreen')}
// // // //             activeOpacity={0.7}
// // // //           >
// // // //             <Icon name="settings-outline" size={22} color="#FFFFFF" />
// // // //             <Text style={styles.navLabel}>Settings</Text>
// // // //           </TouchableOpacity>
// // // //         </View>
// // // //       </View>
// // // //     </SafeAreaView>
// // // //   );
// // // // };

// // // // export default GroupDashboard;

// // // // // ============================================================
// // // // // STYLES
// // // // // ============================================================
// // // // const styles = StyleSheet.create({
// // // //   container: {
// // // //     flex: 1,
// // // //   },

// // // //   scrollContainer: {
// // // //     paddingHorizontal: 16,
// // // //     paddingTop: 8,
// // // //     paddingBottom: 160,
// // // //   },

// // // //   // ==========================================================
// // // //   // HEADER
// // // //   // ==========================================================
// // // //   header: {
// // // //     flexDirection: 'row',
// // // //     justifyContent: 'space-between',
// // // //     alignItems: 'center',
// // // //     paddingHorizontal: 16,
// // // //     paddingVertical: 12,
// // // //   },

// // // //   iconIconButton: {
// // // //     padding: 6,
// // // //     borderRadius: 8,
// // // //     justifyContent: 'center',
// // // //     alignItems: 'center',
// // // //   },

// // // //   headerBox: {
// // // //     paddingHorizontal: 16,
// // // //     paddingVertical: 8,
// // // //     borderRadius: 20,
// // // //     shadowColor: '#000',
// // // //     shadowOffset: { width: 0, height: 2 },
// // // //     shadowOpacity: 0.05,
// // // //     shadowRadius: 4,
// // // //     elevation: 2,
// // // //   },

// // // //   headerText: {
// // // //     fontSize: 14,
// // // //     fontWeight: '800',
// // // //     letterSpacing: 1.2,
// // // //   },

// // // //   headerActions: {
// // // //     flexDirection: 'row',
// // // //     alignItems: 'center',
// // // //     gap: 8,
// // // //   },

// // // //   // ==========================================================
// // // //   // TABS
// // // //   // ==========================================================
// // // //   tabContainer: {
// // // //     flexDirection: 'row',
// // // //     padding: 4,
// // // //     borderRadius: 14,
// // // //     marginVertical: 12,
// // // //   },

// // // //   tab: {
// // // //     flex: 1,
// // // //     paddingVertical: 8,
// // // //     borderRadius: 10,
// // // //     alignItems: 'center',
// // // //     justifyContent: 'center',
// // // //   },

// // // //   activeTab: {
// // // //     shadowColor: '#000',
// // // //     shadowOffset: { width: 0, height: 1 },
// // // //     shadowOpacity: 0.1,
// // // //     shadowRadius: 2,
// // // //     elevation: 2,
// // // //   },

// // // //   tabText: {
// // // //     fontSize: 11,
// // // //     letterSpacing: 0.2,
// // // //   },

// // // //   // ==========================================================
// // // //   // TYPE TOGGLE
// // // //   // ==========================================================
// // // //   toggleBox: {
// // // //     flexDirection: 'row',
// // // //     alignItems: 'center',
// // // //     justifyContent: 'space-around',
// // // //     borderRadius: 14,
// // // //     paddingVertical: 12,
// // // //     paddingHorizontal: 16,
// // // //     marginBottom: 16,
// // // //     shadowColor: '#000',
// // // //     shadowOffset: { width: 0, height: 2 },
// // // //     shadowOpacity: 0.04,
// // // //     shadowRadius: 6,
// // // //     elevation: 1,
// // // //   },

// // // //   toggleItem: {
// // // //     flexDirection: 'row',
// // // //     alignItems: 'center',
// // // //     paddingVertical: 2,
// // // //   },

// // // //   toggleDivider: {
// // // //     width: 1,
// // // //     height: 18,
// // // //     backgroundColor: '#E0E0E0',
// // // //   },

// // // //   toggleText: {
// // // //     fontSize: 13,
// // // //   },

// // // //   radioOuter: {
// // // //     width: 18,
// // // //     height: 18,
// // // //     borderRadius: 9,
// // // //     borderWidth: 2,
// // // //     marginRight: 8,
// // // //     alignItems: 'center',
// // // //     justifyContent: 'center',
// // // //   },

// // // //   radioInner: {
// // // //     width: 8,
// // // //     height: 8,
// // // //     borderRadius: 4,
// // // //   },

// // // //   // ==========================================================
// // // //   // SECTION TITLE
// // // //   // ==========================================================
// // // //   sectionHeader: {
// // // //     flexDirection: 'row',
// // // //     alignItems: 'center',
// // // //     marginBottom: 12,
// // // //     marginTop: 4,
// // // //   },

// // // //   sectionTitle: {
// // // //     fontSize: 16,
// // // //     fontWeight: '800',
// // // //     letterSpacing: 0.5,
// // // //   },

// // // //   badgeCount: {
// // // //     backgroundColor: '#0066FF20',
// // // //     paddingHorizontal: 8,
// // // //     paddingVertical: 2,
// // // //     borderRadius: 10,
// // // //     marginLeft: 8,
// // // //   },

// // // //   badgeCountText: {
// // // //     fontSize: 12,
// // // //     fontWeight: '700',
// // // //     color: '#0066FF',
// // // //   },

// // // //   loaderContainer: {
// // // //     paddingVertical: 40,
// // // //     alignItems: 'center',
// // // //   },

// // // //   emptyContainer: {
// // // //     alignItems: 'center',
// // // //     justifyContent: 'center',
// // // //     paddingVertical: 48,
// // // //   },

// // // //   noTasksText: {
// // // //     marginTop: 12,
// // // //     fontSize: 14,
// // // //     fontWeight: '500',
// // // //   },

// // // //   // ==========================================================
// // // //   // TASK CARD
// // // //   // ==========================================================
// // // //   card: {
// // // //     borderRadius: 16,
// // // //     padding: 14,
// // // //     marginBottom: 10,
// // // //     flexDirection: 'row',
// // // //     justifyContent: 'space-between',
// // // //     alignItems: 'center',
// // // //     shadowColor: '#000',
// // // //     shadowOffset: { width: 0, height: 2 },
// // // //     shadowOpacity: 0.05,
// // // //     shadowRadius: 5,
// // // //     elevation: 2,
// // // //   },

// // // //   completedCard: {
// // // //     opacity: 0.65,
// // // //     borderLeftWidth: 4,
// // // //     borderLeftColor: '#34C759',
// // // //   },

// // // //   cardLeft: {
// // // //     flexDirection: 'row',
// // // //     alignItems: 'center',
// // // //     flex: 1,
// // // //     marginRight: 8,
// // // //   },

// // // //   clock: {
// // // //     width: 38,
// // // //     height: 38,
// // // //     borderRadius: 12,
// // // //     borderWidth: 1.5,
// // // //     justifyContent: 'center',
// // // //     alignItems: 'center',
// // // //     marginRight: 12,
// // // //   },

// // // //   taskInfo: {
// // // //     flex: 1,
// // // //   },

// // // //   taskTitle: {
// // // //     fontSize: 14,
// // // //     fontWeight: '700',
// // // //     lineHeight: 18,
// // // //   },

// // // //   taskDate: {
// // // //     fontSize: 11,
// // // //     marginTop: 3,
// // // //     fontWeight: '500',
// // // //   },

// // // //   completedText: {
// // // //     textDecorationLine: 'line-through',
// // // //   },

// // // //   completedBadge: {
// // // //     fontSize: 10,
// // // //     color: '#34C759',
// // // //     fontWeight: '700',
// // // //     marginTop: 3,
// // // //   },

// // // //   // ==========================================================
// // // //   // TASK ACTIONS
// // // //   // ==========================================================
// // // //   taskActions: {
// // // //     flexDirection: 'row',
// // // //     alignItems: 'center',
// // // //     gap: 8,
// // // //   },

// // // //   actionBtn: {
// // // //     padding: 6,
// // // //     borderRadius: 8,
// // // //   },

// // // //   checkbox: {
// // // //     width: 22,
// // // //     height: 22,
// // // //     borderWidth: 2,
// // // //     justifyContent: 'center',
// // // //     alignItems: 'center',
// // // //     borderRadius: 6,
// // // //     marginLeft: 4,
// // // //   },

// // // //   checkboxDone: {
// // // //     backgroundColor: '#34C759',
// // // //     borderColor: '#34C759',
// // // //   },

// // // //   // ==========================================================
// // // //   // FAB
// // // //   // ==========================================================
// // // //   fab: {
// // // //     position: 'absolute',
// // // //     right: 20,
// // // //     bottom: 128,
// // // //     width: 56,
// // // //     height: 56,
// // // //     borderRadius: 28,
// // // //     justifyContent: 'center',
// // // //     alignItems: 'center',
// // // //     shadowColor: '#0066FF',
// // // //     shadowOffset: { width: 0, height: 4 },
// // // //     shadowOpacity: 0.3,
// // // //     shadowRadius: 8,
// // // //     elevation: 6,
// // // //     zIndex: 99,
// // // //   },

// // // //   fabDisabled: {
// // // //     opacity: 0.5,
// // // //   },

// // // //   // ==========================================================
// // // //   // CATEGORY & BOTTOM NAVIGATION WRAPPER
// // // //   // ==========================================================
// // // //   bottomSectionWrapper: {
// // // //     position: 'absolute',
// // // //     bottom: 0,
// // // //     left: 0,
// // // //     right: 0,
// // // //     width: SCREEN_WIDTH,
// // // //   },

// // // //   categoryContainer: {
// // // //     paddingVertical: 10,
// // // //     backgroundColor: 'transparent',
// // // //   },

// // // //   categoryScrollContent: {
// // // //     paddingHorizontal: 16,
// // // //     alignItems: 'center',
// // // //   },

// // // //   categoryChip: {
// // // //     paddingVertical: 8,
// // // //     paddingHorizontal: 16,
// // // //     borderRadius: 20,
// // // //     marginRight: 8,
// // // //   },

// // // //   categoryText: {
// // // //     fontSize: 12,
// // // //     fontWeight: '700',
// // // //   },

// // // //   smallAdd: {
// // // //     width: 32,
// // // //     height: 32,
// // // //     borderRadius: 16,
// // // //     justifyContent: 'center',
// // // //     alignItems: 'center',
// // // //   },

// // // //   bottom: {
// // // //     width: '100%',
// // // //     height: 60,
// // // //     flexDirection: 'row',
// // // //     justifyContent: 'space-around',
// // // //     alignItems: 'center',
// // // //     borderTopLeftRadius: 18,
// // // //     borderTopRightRadius: 18,
// // // //     paddingHorizontal: 8,
// // // //   },

// // // //   iconBtn: {
// // // //     flex: 1,
// // // //     alignItems: 'center',
// // // //     justifyContent: 'center',
// // // //     paddingVertical: 4,
// // // //   },

// // // //   navLabel: {
// // // //     color: '#FFFFFF',
// // // //     fontSize: 10,
// // // //     marginTop: 2,
// // // //     fontWeight: '500',
// // // //   },
// // // // });




































// // // // // import React, { useState, useCallback } from 'react';
// // // // // import {
// // // // //   View,
// // // // //   Text,
// // // // //   StyleSheet,
// // // // //   SafeAreaView,
// // // // //   TouchableOpacity,
// // // // //   ScrollView,
// // // // //   ActivityIndicator,
// // // // //   Alert,
// // // // //   StatusBar,
// // // // // } from 'react-native';

// // // // // import Icon from '@react-native-vector-icons/ionicons';
// // // // // import AsyncStorage from '@react-native-async-storage/async-storage';
// // // // // import { useTheme } from '../../context/ThemeContext';
// // // // // import { useFocusEffect } from '@react-navigation/native';
// // // // // import { BASE_URL } from '../../config/api';

// // // // // // ============================================================
// // // // // // GO TO LOGIN
// // // // // // AuthStack -> Login
// // // // // // ============================================================
// // // // // const goToLogin = navigation => {
// // // // //   navigation.reset({
// // // // //     index: 0,
// // // // //     routes: [
// // // // //       {
// // // // //         name: 'AuthStack',
// // // // //         state: {
// // // // //           routes: [{ name: 'Login' }],
// // // // //         },
// // // // //       },
// // // // //     ],
// // // // //   });
// // // // // };

// // // // // // ============================================================
// // // // // // GROUP DASHBOARD
// // // // // // ============================================================
// // // // // const GroupDashboard = ({ navigation, route }) => {
// // // // //   const { isDark, theme } = useTheme();

// // // // //   // Group name received from HomeDashboard
// // // // //   const targetGroupName = (
// // // // //     route?.params?.groupName || ''
// // // // //   ).toUpperCase();

// // // // //   const [selectedTab, setSelectedTab] = useState('ALL');
// // // // //   const [selectedMode, setSelectedMode] = useState('time');

// // // // //   const [tasks, setTasks] = useState([]);
// // // // //   const [loading, setLoading] = useState(false);

// // // // //   const [groupId, setGroupId] = useState(null);
// // // // //   const [allGroupNames, setAllGroupNames] = useState([]);

// // // // //   const tabs = ['ALL', 'TODAY', 'PENDING', 'UPCOMING'];

// // // // //   // SELF + all dynamic groups
// // // // //   const categories = [
// // // // //     'SELF',
// // // // //     ...allGroupNames.filter(
// // // // //       (group, index, array) =>
// // // // //         array.indexOf(group) === index
// // // // //     ),
// // // // //   ];

// // // // //   // ============================================================
// // // // //   // GET JWT TOKEN
// // // // //   // IMPORTANT:
// // // // //   // LoginScreen stores token using AsyncStorage key "token"
// // // // //   // ============================================================
// // // // //   const getToken = async () => {
// // // // //     try {
// // // // //       const token = await AsyncStorage.getItem('token');

// // // // //       if (!token) {
// // // // //         Alert.alert(
// // // // //           'Session Expired',
// // // // //           'Your session has expired. Please login again.',
// // // // //           [
// // // // //             {
// // // // //               text: 'OK',
// // // // //               onPress: () => goToLogin(navigation),
// // // // //             },
// // // // //           ]
// // // // //         );

// // // // //         return null;
// // // // //       }

// // // // //       return token;
// // // // //     } catch (error) {
// // // // //       console.log('Get Token Error:', error);
// // // // //       return null;
// // // // //     }
// // // // //   };

// // // // //   // ============================================================
// // // // //   // GENERIC API FETCH
// // // // //   // ============================================================
// // // // //   const apiFetch = async (endpoint, options = {}) => {
// // // // //     const token = await getToken();

// // // // //     if (!token) {
// // // // //       throw new Error('Authentication required');
// // // // //     }

// // // // //     const response = await fetch(
// // // // //       `${BASE_URL}${endpoint}`,
// // // // //       {
// // // // //         ...options,
// // // // //         headers: {
// // // // //           Accept: 'application/json',
// // // // //           'Content-Type': 'application/json',
// // // // //           Authorization: `Bearer ${token}`,
// // // // //           ...(options.headers || {}),
// // // // //         },
// // // // //       }
// // // // //     );

// // // // //     // Prevent JSON Parse error when backend returns empty body
// // // // //     let data = null;

// // // // //     try {
// // // // //       const text = await response.text();

// // // // //       if (text) {
// // // // //         data = JSON.parse(text);
// // // // //       }
// // // // //     } catch (error) {
// // // // //       console.log('Response JSON Parse Error:', error);
// // // // //       data = null;
// // // // //     }

// // // // //     console.log(
// // // // //       `API ${options.method || 'GET'} ${endpoint}:`,
// // // // //       response.status,
// // // // //       data
// // // // //     );

// // // // //     // ==========================================================
// // // // //     // UNAUTHORIZED
// // // // //     // ==========================================================
// // // // //     if (response.status === 401) {
// // // // //       await AsyncStorage.removeItem('token');

// // // // //       Alert.alert(
// // // // //         'Session Expired',
// // // // //         'Please login again.',
// // // // //         [
// // // // //           {
// // // // //             text: 'OK',
// // // // //             onPress: () => goToLogin(navigation),
// // // // //           },
// // // // //         ]
// // // // //       );

// // // // //       throw new Error('Session expired');
// // // // //     }

// // // // //     // ==========================================================
// // // // //     // OTHER API ERRORS
// // // // //     // ==========================================================
// // // // //     if (!response.ok) {
// // // // //       throw new Error(
// // // // //         data?.message ||
// // // // //           data?.error ||
// // // // //           `Request failed with status ${response.status}`
// // // // //       );
// // // // //     }

// // // // //     return data;
// // // // //   };

// // // // //   // ============================================================
// // // // //   // FETCH GROUPS + GROUP TASKS
// // // // //   // ============================================================
// // // // //   const fetchData = useCallback(async () => {
// // // // //     try {
// // // // //       setLoading(true);

// // // // //       // ========================================================
// // // // //       // 1. FETCH GROUPS
// // // // //       // Same route pattern used by HomeDashboard
// // // // //       // ========================================================
// // // // //       const groupsResponse = await apiFetch('/Task/groups');

// // // // //       console.log(
// // // // //         'Fetch Groups Response:',
// // // // //         groupsResponse
// // // // //       );

// // // // //       if (
// // // // //         !groupsResponse ||
// // // // //         !groupsResponse.success
// // // // //       ) {
// // // // //         setTasks([]);
// // // // //         return;
// // // // //       }

// // // // //       const groups = groupsResponse.data || [];

// // // // //       // ========================================================
// // // // //       // CREATE DYNAMIC GROUP CATEGORY LIST
// // // // //       // ========================================================
// // // // //       const names = groups
// // // // //         .map(group => group?.name)
// // // // //         .filter(Boolean)
// // // // //         .map(name => name.toUpperCase());

// // // // //       setAllGroupNames(names);

// // // // //       // ========================================================
// // // // //       // FIND CURRENT GROUP
// // // // //       // ========================================================
// // // // //       const targetGroup = groups.find(
// // // // //         group =>
// // // // //           group?.name &&
// // // // //           group.name.toUpperCase() ===
// // // // //             targetGroupName
// // // // //       );

// // // // //       if (!targetGroup) {
// // // // //         console.log(
// // // // //           'Group not found:',
// // // // //           targetGroupName
// // // // //         );

// // // // //         setGroupId(null);
// // // // //         setTasks([]);

// // // // //         return;
// // // // //       }

// // // // //       const currentGroupId = targetGroup.id;

// // // // //       setGroupId(currentGroupId);

// // // // //       console.log(
// // // // //         'Selected Group:',
// // // // //         targetGroup.name
// // // // //       );

// // // // //       console.log(
// // // // //         'Selected Group ID:',
// // // // //         currentGroupId
// // // // //       );

// // // // //       // ========================================================
// // // // //       // 2. FETCH TASKS FOR CURRENT GROUP
// // // // //       //
// // // // //       // Same query style as HomeDashboard:
// // // // //       // /Task/personal?tab=...&isTimeBased=...
// // // // //       //
// // // // //       // Group version:
// // // // //       // /Task/group?tab=...&isTimeBased=...&groupId=...
// // // // //       // ========================================================
// // // // //       const isTimeBased =
// // // // //         selectedMode === 'time';

// // // // //       const tabParam =
// // // // //         selectedTab === 'ALL'
// // // // //           ? ''
// // // // //           : selectedTab.toLowerCase();

// // // // //       const query =
// // // // //         `/Task/group?tab=${encodeURIComponent(
// // // // //           tabParam
// // // // //         )}` +
// // // // //         `&isTimeBased=${isTimeBased}` +
// // // // //         `&groupId=${encodeURIComponent(
// // // // //           currentGroupId
// // // // //         )}`;

// // // // //       console.log(
// // // // //         'Fetching Group Tasks:',
// // // // //         `${BASE_URL}${query}`
// // // // //       );

// // // // //       const tasksResponse = await apiFetch(
// // // // //         query
// // // // //       );

// // // // //       console.log(
// // // // //         'Fetch Group Tasks Response:',
// // // // //         tasksResponse
// // // // //       );

// // // // //       if (
// // // // //         tasksResponse?.success
// // // // //       ) {
// // // // //         setTasks(
// // // // //           tasksResponse.data || []
// // // // //         );
// // // // //       } else {
// // // // //         setTasks([]);
// // // // //       }
// // // // //     } catch (error) {
// // // // //       console.log(
// // // // //         'GroupDashboard fetchData Error:',
// // // // //         error
// // // // //       );

// // // // //       if (
// // // // //         error?.message !==
// // // // //           'Authentication required' &&
// // // // //         error?.message !==
// // // // //           'Session expired'
// // // // //       ) {
// // // // //         Alert.alert(
// // // // //           'Error',
// // // // //           error?.message ||
// // // // //             'Failed to load group tasks.'
// // // // //         );
// // // // //       }
// // // // //     } finally {
// // // // //       setLoading(false);
// // // // //     }
// // // // //   }, [
// // // // //     targetGroupName,
// // // // //     selectedTab,
// // // // //     selectedMode,
// // // // //   ]);

// // // // //   // ============================================================
// // // // //   // REFRESH WHEN SCREEN GETS FOCUS
// // // // //   // ============================================================
// // // // //   useFocusEffect(
// // // // //     useCallback(() => {
// // // // //       fetchData();
// // // // //     }, [fetchData])
// // // // //   );

// // // // //   // ============================================================
// // // // //   // MARK TASK AS DONE
// // // // //   // Same route as HomeDashboard
// // // // //   // POST /Task/{id}/done
// // // // //   // ============================================================
// // // // //   const handleMarkDone = async task => {
// // // // //     try {
// // // // //       setLoading(true);

// // // // //       await apiFetch(
// // // // //         `/Task/${task.id}/done`,
// // // // //         {
// // // // //           method: 'POST',
// // // // //         }
// // // // //       );

// // // // //       Alert.alert(
// // // // //         '✅ Task Completed!',
// // // // //         `"${task.title}" has been marked as done.`
// // // // //       );

// // // // //       await fetchData();
// // // // //     } catch (error) {
// // // // //       console.log(
// // // // //         'Mark Done Error:',
// // // // //         error
// // // // //       );

// // // // //       if (
// // // // //         error?.message !==
// // // // //           'Authentication required' &&
// // // // //         error?.message !==
// // // // //           'Session expired'
// // // // //       ) {
// // // // //         Alert.alert(
// // // // //           'Error',
// // // // //           error?.message ||
// // // // //             'Failed to mark task as done.'
// // // // //         );
// // // // //       }
// // // // //     } finally {
// // // // //       setLoading(false);
// // // // //     }
// // // // //   };

// // // // //   // ============================================================
// // // // //   // DELETE TASK
// // // // //   // Same route as HomeDashboard
// // // // //   // DELETE /Task/task/{id}
// // // // //   // ============================================================
// // // // //   const handleDeleteTask = taskId => {
// // // // //     Alert.alert(
// // // // //       'Delete Task',
// // // // //       'Are you sure you want to delete this task?',
// // // // //       [
// // // // //         {
// // // // //           text: 'Cancel',
// // // // //           style: 'cancel',
// // // // //         },

// // // // //         {
// // // // //           text: 'Delete',
// // // // //           style: 'destructive',

// // // // //           onPress: async () => {
// // // // //             try {
// // // // //               setLoading(true);

// // // // //               await apiFetch(
// // // // //                 `/Task/task/${taskId}`,
// // // // //                 {
// // // // //                   method: 'DELETE',
// // // // //                 }
// // // // //               );

// // // // //               Alert.alert(
// // // // //                 'Success',
// // // // //                 'Task deleted successfully.'
// // // // //               );

// // // // //               await fetchData();
// // // // //             } catch (error) {
// // // // //               console.log(
// // // // //                 'Delete Task Error:',
// // // // //                 error
// // // // //               );

// // // // //               if (
// // // // //                 error?.message !==
// // // // //                   'Authentication required' &&
// // // // //                 error?.message !==
// // // // //                   'Session expired'
// // // // //               ) {
// // // // //                 Alert.alert(
// // // // //                   'Error',
// // // // //                   error?.message ||
// // // // //                     'Failed to delete task.'
// // // // //                 );
// // // // //               }
// // // // //             } finally {
// // // // //               setLoading(false);
// // // // //             }
// // // // //           },
// // // // //         },
// // // // //       ]
// // // // //     );
// // // // //   };

// // // // //   // ============================================================
// // // // //   // DELETE GROUP
// // // // //   // ============================================================
// // // // //   const handleDeleteGroup = () => {
// // // // //     if (!groupId) {
// // // // //       Alert.alert(
// // // // //         'Error',
// // // // //         'Group information is not available yet.'
// // // // //       );

// // // // //       return;
// // // // //     }

// // // // //     Alert.alert(
// // // // //       'Delete Group',
// // // // //       `Delete "${targetGroupName}" group and all its tasks?`,
// // // // //       [
// // // // //         {
// // // // //           text: 'Cancel',
// // // // //           style: 'cancel',
// // // // //         },

// // // // //         {
// // // // //           text: 'Delete',
// // // // //           style: 'destructive',

// // // // //           onPress: async () => {
// // // // //             try {
// // // // //               setLoading(true);

// // // // //               // Group CRUD is under Task controller
// // // // //               await apiFetch(
// // // // //                 `/Task/groups/${groupId}`,
// // // // //                 {
// // // // //                   method: 'DELETE',
// // // // //                 }
// // // // //               );

// // // // //               Alert.alert(
// // // // //                 'Deleted',
// // // // //                 `"${targetGroupName}" group deleted successfully.`,
// // // // //                 [
// // // // //                   {
// // // // //                     text: 'OK',
// // // // //                     onPress: () =>
// // // // //                       navigation.navigate(
// // // // //                         'HomeDashboard'
// // // // //                       ),
// // // // //                   },
// // // // //                 ]
// // // // //               );
// // // // //             } catch (error) {
// // // // //               console.log(
// // // // //                 'Delete Group Error:',
// // // // //                 error
// // // // //               );

// // // // //               if (
// // // // //                 error?.message !==
// // // // //                   'Authentication required' &&
// // // // //                 error?.message !==
// // // // //                   'Session expired'
// // // // //               ) {
// // // // //                 Alert.alert(
// // // // //                   'Error',
// // // // //                   error?.message ||
// // // // //                     'Failed to delete group.'
// // // // //                 );
// // // // //               }
// // // // //             } finally {
// // // // //               setLoading(false);
// // // // //             }
// // // // //           },
// // // // //         },
// // // // //       ]
// // // // //     );
// // // // //   };

// // // // //   // ============================================================
// // // // //   // CATEGORY NAVIGATION
// // // // //   // ============================================================
// // // // //   const handleCategory = category => {
// // // // //     if (category === 'SELF') {
// // // // //       navigation.navigate(
// // // // //         'HomeDashboard'
// // // // //       );

// // // // //       return;
// // // // //     }

// // // // //     if (
// // // // //       category === targetGroupName
// // // // //     ) {
// // // // //       return;
// // // // //     }

// // // // //     navigation.replace(
// // // // //       'GroupDashboard',
// // // // //       {
// // // // //         groupName: category,
// // // // //       }
// // // // //     );
// // // // //   };

// // // // //   // ============================================================
// // // // //   // ADD TASK
// // // // //   // ============================================================
// // // // //   const handleAddTask = () => {
// // // // //     if (!groupId) {
// // // // //       Alert.alert(
// // // // //         'Please wait',
// // // // //         'Group information is still loading.'
// // // // //       );

// // // // //       return;
// // // // //     }

// // // // //     if (selectedMode === 'time') {
// // // // //       navigation.navigate(
// // // // //         'AddTaskTimeBased',
// // // // //         {
// // // // //           groupId: groupId,
// // // // //         }
// // // // //       );
// // // // //     } else {
// // // // //       navigation.navigate(
// // // // //         'AddTaskNonTimeBased',
// // // // //         {
// // // // //           groupId: groupId,
// // // // //         }
// // // // //       );
// // // // //     }
// // // // //   };

// // // // //   // ============================================================
// // // // //   // EDIT TASK
// // // // //   // ============================================================
// // // // //   const handleEdit = task => {
// // // // //     if (selectedMode === 'time') {
// // // // //       navigation.navigate(
// // // // //         'EditTaskTimeBased',
// // // // //         {
// // // // //           task,
// // // // //         }
// // // // //       );
// // // // //     } else {
// // // // //       navigation.navigate(
// // // // //         'EditTaskNonTimeBased',
// // // // //         {
// // // // //           task,
// // // // //         }
// // // // //       );
// // // // //     }
// // // // //   };

// // // // //   // ============================================================
// // // // //   // RENDER
// // // // //   // ============================================================
// // // // //   return (
// // // // //     <SafeAreaView
// // // // //       style={[
// // // // //         styles.container,
// // // // //         {
// // // // //           backgroundColor: theme.bg,
// // // // //         },
// // // // //       ]}
// // // // //     >
// // // // //       <StatusBar
// // // // //         barStyle={
// // // // //           isDark
// // // // //             ? 'light-content'
// // // // //             : 'dark-content'
// // // // //         }
// // // // //         backgroundColor="#B7C9DB"
// // // // //       />

// // // // //       {/* ======================================================
// // // // //           HEADER
// // // // //       ====================================================== */}
// // // // //       <View style={styles.header}>
// // // // //         {/* BACK */}
// // // // //         <TouchableOpacity
// // // // //           onPress={() =>
// // // // //             navigation.goBack()
// // // // //           }
// // // // //         >
// // // // //           <Icon
// // // // //             name="arrow-back"
// // // // //             size={22}
// // // // //             color={theme.text}
// // // // //           />
// // // // //         </TouchableOpacity>

// // // // //         {/* TITLE */}
// // // // //         <View
// // // // //           style={[
// // // // //             styles.headerBox,
// // // // //             {
// // // // //               backgroundColor:
// // // // //                 theme.headerBox,
// // // // //             },
// // // // //           ]}
// // // // //         >
// // // // //           <Text
// // // // //             style={[
// // // // //               styles.headerText,
// // // // //               {
// // // // //                 color: theme.text,
// // // // //               },
// // // // //             ]}
// // // // //           >
// // // // //             TO-DO-LIST
// // // // //           </Text>
// // // // //         </View>

// // // // //         {/* RIGHT ICONS */}
// // // // //         <View style={styles.headerActions}>
// // // // //           {/* DELETE GROUP */}
// // // // //           <TouchableOpacity
// // // // //             onPress={
// // // // //               handleDeleteGroup
// // // // //             }
// // // // //             disabled={
// // // // //               !groupId || loading
// // // // //             }
// // // // //           >
// // // // //             <Icon
// // // // //               name="trash-outline"
// // // // //               size={20}
// // // // //               color={
// // // // //                 !groupId || loading
// // // // //                   ? '#999'
// // // // //                   : '#E52323'
// // // // //               }
// // // // //             />
// // // // //           </TouchableOpacity>

// // // // //           {/* NOTIFICATION */}
// // // // //           <TouchableOpacity
// // // // //             onPress={() =>
// // // // //               navigation.navigate(
// // // // //                 'NotificationScreen'
// // // // //               )
// // // // //             }
// // // // //           >
// // // // //             <Icon
// // // // //               name="notifications-outline"
// // // // //               size={22}
// // // // //               color={theme.text}
// // // // //             />
// // // // //           </TouchableOpacity>
// // // // //         </View>
// // // // //       </View>

// // // // //       {/* ======================================================
// // // // //           MAIN CONTENT
// // // // //       ====================================================== */}
// // // // //       <ScrollView
// // // // //         contentContainerStyle={{
// // // // //           paddingBottom: 180,
// // // // //         }}
// // // // //         showsVerticalScrollIndicator={
// // // // //           false
// // // // //         }
// // // // //       >
// // // // //         {/* ====================================================
// // // // //             TABS
// // // // //         ==================================================== */}
// // // // //         <View
// // // // //           style={[
// // // // //             styles.tabContainer,
// // // // //             {
// // // // //               backgroundColor:
// // // // //                 theme.filterBg,
// // // // //             },
// // // // //           ]}
// // // // //         >
// // // // //           {tabs.map(tab => (
// // // // //             <TouchableOpacity
// // // // //               key={tab}
// // // // //               style={[
// // // // //                 styles.tab,
// // // // //                 {
// // // // //                   backgroundColor:
// // // // //                     theme.card,
// // // // //                 },
// // // // //                 selectedTab === tab &&
// // // // //                   styles.activeTab,
// // // // //               ]}
// // // // //               onPress={() =>
// // // // //                 setSelectedTab(tab)
// // // // //               }
// // // // //             >
// // // // //               <Text
// // // // //                 style={[
// // // // //                   styles.tabText,
// // // // //                   {
// // // // //                     color: theme.text,
// // // // //                   },
// // // // //                 ]}
// // // // //               >
// // // // //                 {tab}
// // // // //               </Text>
// // // // //             </TouchableOpacity>
// // // // //           ))}
// // // // //         </View>

// // // // //         {/* ====================================================
// // // // //             TIME / NON-TIME
// // // // //         ==================================================== */}
// // // // //         <View
// // // // //           style={[
// // // // //             styles.toggleBox,
// // // // //             {
// // // // //               backgroundColor:
// // // // //                 theme.headerBox,
// // // // //             },
// // // // //           ]}
// // // // //         >
// // // // //           {/* TIME */}
// // // // //           <TouchableOpacity
// // // // //             style={styles.toggleItem}
// // // // //             onPress={() =>
// // // // //               setSelectedMode('time')
// // // // //             }
// // // // //           >
// // // // //             <View
// // // // //               style={[
// // // // //                 styles.radioOuter,
// // // // //                 {
// // // // //                   borderColor:
// // // // //                     theme.text,
// // // // //                 },
// // // // //               ]}
// // // // //             >
// // // // //               {selectedMode ===
// // // // //                 'time' && (
// // // // //                 <View
// // // // //                   style={[
// // // // //                     styles.radioInner,
// // // // //                     {
// // // // //                       backgroundColor:
// // // // //                         theme.text,
// // // // //                     },
// // // // //                   ]}
// // // // //                 />
// // // // //               )}
// // // // //             </View>

// // // // //             <Text
// // // // //               style={{
// // // // //                 color: theme.text,
// // // // //               }}
// // // // //             >
// // // // //               Time Based
// // // // //             </Text>
// // // // //           </TouchableOpacity>

// // // // //           {/* NON-TIME */}
// // // // //           <TouchableOpacity
// // // // //             style={styles.toggleItem}
// // // // //             onPress={() =>
// // // // //               setSelectedMode('non')
// // // // //             }
// // // // //           >
// // // // //             <View
// // // // //               style={[
// // // // //                 styles.radioOuter,
// // // // //                 {
// // // // //                   borderColor:
// // // // //                     theme.text,
// // // // //                 },
// // // // //               ]}
// // // // //             >
// // // // //               {selectedMode ===
// // // // //                 'non' && (
// // // // //                 <View
// // // // //                   style={[
// // // // //                     styles.radioInner,
// // // // //                     {
// // // // //                       backgroundColor:
// // // // //                         theme.text,
// // // // //                     },
// // // // //                   ]}
// // // // //                 />
// // // // //               )}
// // // // //             </View>

// // // // //             <Text
// // // // //               style={{
// // // // //                 color: theme.text,
// // // // //               }}
// // // // //             >
// // // // //               Non Time Based
// // // // //             </Text>
// // // // //           </TouchableOpacity>
// // // // //         </View>

// // // // //         {/* ====================================================
// // // // //             GROUP NAME
// // // // //         ==================================================== */}
// // // // //         <Text
// // // // //           style={[
// // // // //             styles.section,
// // // // //             {
// // // // //               color: theme.text,
// // // // //             },
// // // // //           ]}
// // // // //         >
// // // // //           {targetGroupName}:
// // // // //         </Text>

// // // // //         {/* ====================================================
// // // // //             LOADING
// // // // //         ==================================================== */}
// // // // //         {loading ? (
// // // // //           <ActivityIndicator
// // // // //             size="large"
// // // // //             color={theme.text}
// // // // //             style={{
// // // // //               marginTop: 20,
// // // // //             }}
// // // // //           />
// // // // //         ) : tasks.length === 0 ? (
// // // // //           /* ==================================================
// // // // //              NO TASKS
// // // // //           ================================================== */
// // // // //           <Text
// // // // //             style={[
// // // // //               styles.noTasks,
// // // // //               {
// // // // //                 color: theme.text,
// // // // //               },
// // // // //             ]}
// // // // //           >
// // // // //             No tasks found.
// // // // //           </Text>
// // // // //         ) : (
// // // // //           /* ==================================================
// // // // //              TASK LIST
// // // // //           ================================================== */
// // // // //           tasks.map(task => (
// // // // //             <TouchableOpacity
// // // // //               key={task.id}
// // // // //               style={[
// // // // //                 styles.card,
// // // // //                 {
// // // // //                   backgroundColor:
// // // // //                     theme.card,
// // // // //                 },
// // // // //                 task.isCompleted &&
// // // // //                   styles.completedCard,
// // // // //               ]}
// // // // //               activeOpacity={0.8}
// // // // //               onPress={() =>
// // // // //                 navigation.navigate(
// // // // //                   'TaskGroupOverviewScreen',
// // // // //                   {
// // // // //                     task,
// // // // //                   }
// // // // //                 )
// // // // //               }
// // // // //             >
// // // // //               {/* LEFT SIDE */}
// // // // //               <View
// // // // //                 style={styles.cardLeft}
// // // // //               >
// // // // //                 {/* CLOCK */}
// // // // //                 <View
// // // // //                   style={[
// // // // //                     styles.clock,
// // // // //                     {
// // // // //                       borderColor:
// // // // //                         theme.text,
// // // // //                     },
// // // // //                   ]}
// // // // //                 >
// // // // //                   <Icon
// // // // //                     name="time-outline"
// // // // //                     size={20}
// // // // //                     color={theme.text}
// // // // //                   />
// // // // //                 </View>

// // // // //                 {/* TASK INFORMATION */}
// // // // //                 <View
// // // // //                   style={{
// // // // //                     flex: 1,
// // // // //                   }}
// // // // //                 >
// // // // //                   <Text
// // // // //                     style={[
// // // // //                       styles.taskTitle,
// // // // //                       {
// // // // //                         color: theme.text,
// // // // //                       },
// // // // //                       task.isCompleted &&
// // // // //                         styles.completedText,
// // // // //                     ]}
// // // // //                   >
// // // // //                     {task.title}
// // // // //                   </Text>

// // // // //                   <Text
// // // // //                     style={[
// // // // //                       styles.taskDate,
// // // // //                       {
// // // // //                         color: theme.text,
// // // // //                       },
// // // // //                     ]}
// // // // //                   >
// // // // //                     {task.dueDate
// // // // //                       ? `${task.dueDate} ${
// // // // //                           task.dueTime || ''
// // // // //                         }`
// // // // //                       : 'No Due Date'}
// // // // //                   </Text>

// // // // //                   {task.isCompleted && (
// // // // //                     <Text
// // // // //                       style={
// // // // //                         styles.completedBadge
// // // // //                       }
// // // // //                     >
// // // // //                       ✓ Completed
// // // // //                     </Text>
// // // // //                   )}
// // // // //                 </View>
// // // // //               </View>

// // // // //               {/* =================================================
// // // // //                   ACTION BUTTONS
// // // // //               ================================================= */}
// // // // //               <View
// // // // //                 style={
// // // // //                   styles.taskActions
// // // // //                 }
// // // // //               >
// // // // //                 {/* EDIT */}
// // // // //                 <TouchableOpacity
// // // // //                   style={styles.editBtn}
// // // // //                   onPress={event => {
// // // // //                     event.stopPropagation?.();
// // // // //                     handleEdit(task);
// // // // //                   }}
// // // // //                   disabled={loading}
// // // // //                 >
// // // // //                   <Icon
// // // // //                     name="create-outline"
// // // // //                     size={16}
// // // // //                     color={
// // // // //                       loading
// // // // //                         ? '#999'
// // // // //                         : theme.text
// // // // //                     }
// // // // //                   />
// // // // //                 </TouchableOpacity>

// // // // //                 {/* DELETE */}
// // // // //                 <TouchableOpacity
// // // // //                   style={styles.editBtn}
// // // // //                   onPress={event => {
// // // // //                     event.stopPropagation?.();
// // // // //                     handleDeleteTask(
// // // // //                       task.id
// // // // //                     );
// // // // //                   }}
// // // // //                   disabled={loading}
// // // // //                 >
// // // // //                   <Icon
// // // // //                     name="trash-outline"
// // // // //                     size={16}
// // // // //                     color={
// // // // //                       loading
// // // // //                         ? '#999'
// // // // //                         : '#E52323'
// // // // //                     }
// // // // //                   />
// // // // //                 </TouchableOpacity>

// // // // //                 {/* CHECKBOX */}
// // // // //                 <TouchableOpacity
// // // // //                   style={[
// // // // //                     styles.checkbox,
// // // // //                     {
// // // // //                       borderColor:
// // // // //                         theme.text,
// // // // //                     },
// // // // //                     task.isCompleted &&
// // // // //                       styles.checkboxDone,
// // // // //                   ]}
// // // // //                   onPress={event => {
// // // // //                     event.stopPropagation?.();

// // // // //                     if (
// // // // //                       !task.isCompleted
// // // // //                     ) {
// // // // //                       handleMarkDone(
// // // // //                         task
// // // // //                       );
// // // // //                     }
// // // // //                   }}
// // // // //                   disabled={
// // // // //                     task.isCompleted ||
// // // // //                     loading
// // // // //                   }
// // // // //                 >
// // // // //                   {task.isCompleted && (
// // // // //                     <Icon
// // // // //                       name="checkmark"
// // // // //                       size={14}
// // // // //                       color="#fff"
// // // // //                     />
// // // // //                   )}
// // // // //                 </TouchableOpacity>
// // // // //               </View>
// // // // //             </TouchableOpacity>
// // // // //           ))
// // // // //         )}
// // // // //       </ScrollView>

// // // // //       {/* ========================================================
// // // // //           FAB
// // // // //       ======================================================== */}
// // // // //       <TouchableOpacity
// // // // //         style={[
// // // // //           styles.fab,
// // // // //           (!groupId || loading) &&
// // // // //             styles.fabDisabled,
// // // // //         ]}
// // // // //         onPress={handleAddTask}
// // // // //         disabled={!groupId || loading}
// // // // //       >
// // // // //         {loading ? (
// // // // //           <ActivityIndicator
// // // // //             size="small"
// // // // //             color={theme.text}
// // // // //           />
// // // // //         ) : (
// // // // //           <Icon
// // // // //             name="add"
// // // // //             size={28}
// // // // //             color={theme.text}
// // // // //           />
// // // // //         )}
// // // // //       </TouchableOpacity>

// // // // //       {/* ========================================================
// // // // //           CATEGORY BAR
// // // // //       ======================================================== */}
// // // // //       <View
// // // // //         style={styles.categoryContainer}
// // // // //       >
// // // // //         <ScrollView
// // // // //           horizontal
// // // // //           showsHorizontalScrollIndicator={
// // // // //             false
// // // // //           }
// // // // //         >
// // // // //           {categories.map(category => (
// // // // //             <TouchableOpacity
// // // // //               key={category}
// // // // //               style={[
// // // // //                 styles.category,
// // // // //                 category ===
// // // // //                   targetGroupName &&
// // // // //                   styles.activeCategory,
// // // // //                 category === 'SELF' &&
// // // // //                   targetGroupName ===
// // // // //                     'SELF' &&
// // // // //                   styles.activeCategory,
// // // // //               ]}
// // // // //               onPress={() =>
// // // // //                 handleCategory(
// // // // //                   category
// // // // //                 )
// // // // //               }
// // // // //             >
// // // // //               <Text
// // // // //                 style={[
// // // // //                   styles.categoryText,
// // // // //                   {
// // // // //                     color: theme.text,
// // // // //                   },
// // // // //                 ]}
// // // // //               >
// // // // //                 {category}
// // // // //               </Text>
// // // // //             </TouchableOpacity>
// // // // //           ))}

// // // // //           {/* ADD GROUP */}
// // // // //           <TouchableOpacity
// // // // //             style={styles.smallAdd}
// // // // //             onPress={() =>
// // // // //               navigation.navigate(
// // // // //                 'CreateGroup'
// // // // //               )
// // // // //             }
// // // // //           >
// // // // //             <Icon
// // // // //               name="add"
// // // // //               size={16}
// // // // //               color={theme.text}
// // // // //             />
// // // // //           </TouchableOpacity>
// // // // //         </ScrollView>
// // // // //       </View>

// // // // //       {/* ========================================================
// // // // //           BOTTOM NAVIGATION
// // // // //       ======================================================== */}
// // // // //       <View
// // // // //         style={[
// // // // //           styles.bottom,
// // // // //           {
// // // // //             backgroundColor:
// // // // //               theme.bottomNav,
// // // // //           },
// // // // //         ]}
// // // // //       >
// // // // //         {/* HOME */}
// // // // //         <TouchableOpacity
// // // // //           style={styles.iconBtn}
// // // // //           onPress={() =>
// // // // //             navigation.navigate(
// // // // //               'HomeDashboard'
// // // // //             )
// // // // //           }
// // // // //         >
// // // // //           <Icon
// // // // //             name="home"
// // // // //             size={24}
// // // // //             color="#fff"
// // // // //           />
// // // // //         </TouchableOpacity>

// // // // //         {/* CONTACTS */}
// // // // //         <TouchableOpacity
// // // // //           style={styles.iconBtn}
// // // // //           onPress={() =>
// // // // //             navigation.navigate(
// // // // //               'ContactScreen'
// // // // //             )
// // // // //           }
// // // // //         >
// // // // //           <Icon
// // // // //             name="people"
// // // // //             size={24}
// // // // //             color="#fff"
// // // // //           />
// // // // //         </TouchableOpacity>

// // // // //         {/* HISTORY */}
// // // // //         <TouchableOpacity
// // // // //           style={styles.iconBtn}
// // // // //           onPress={() =>
// // // // //             navigation.navigate(
// // // // //               'TimeBasedHistoryScreen'
// // // // //             )
// // // // //           }
// // // // //         >
// // // // //           <Icon
// // // // //             name="time"
// // // // //             size={24}
// // // // //             color="#fff"
// // // // //           />
// // // // //         </TouchableOpacity>

// // // // //         {/* SETTINGS */}
// // // // //         <TouchableOpacity
// // // // //           style={styles.iconBtn}
// // // // //           onPress={() =>
// // // // //             navigation.navigate(
// // // // //               'SettingScreen'
// // // // //             )
// // // // //           }
// // // // //         >
// // // // //           <Icon
// // // // //             name="settings"
// // // // //             size={24}
// // // // //             color="#fff"
// // // // //           />
// // // // //         </TouchableOpacity>
// // // // //       </View>
// // // // //     </SafeAreaView>
// // // // //   );
// // // // // };

// // // // // export default GroupDashboard;

// // // // // // ============================================================
// // // // // // STYLES
// // // // // // ============================================================
// // // // // const styles = StyleSheet.create({
// // // // //   container: {
// // // // //     flex: 1,
// // // // //     paddingHorizontal: 14,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // HEADER
// // // // //   // ==========================================================
// // // // //   header: {
// // // // //     flexDirection: 'row',
// // // // //     justifyContent: 'space-between',
// // // // //     alignItems: 'center',
// // // // //     marginVertical: 10,
// // // // //   },

// // // // //   headerBox: {
// // // // //     paddingHorizontal: 18,
// // // // //     paddingVertical: 6,
// // // // //     borderRadius: 10,
// // // // //     elevation: 3,
// // // // //   },

// // // // //   headerText: {
// // // // //     fontWeight: '800',
// // // // //     letterSpacing: 1,
// // // // //   },

// // // // //   headerActions: {
// // // // //     flexDirection: 'row',
// // // // //     alignItems: 'center',
// // // // //     gap: 12,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // TABS
// // // // //   // ==========================================================
// // // // //   tabContainer: {
// // // // //     flexDirection: 'row',
// // // // //     padding: 6,
// // // // //     borderRadius: 16,
// // // // //     marginBottom: 16,
// // // // //   },

// // // // //   tab: {
// // // // //     flex: 1,
// // // // //     paddingVertical: 8,
// // // // //     borderRadius: 10,
// // // // //     marginHorizontal: 3,
// // // // //     alignItems: 'center',
// // // // //   },

// // // // //   activeTab: {
// // // // //     backgroundColor: '#fff',
// // // // //   },

// // // // //   tabText: {
// // // // //     fontSize: 12,
// // // // //     fontWeight: '700',
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // TYPE TOGGLE
// // // // //   // ==========================================================
// // // // //   toggleBox: {
// // // // //     flexDirection: 'row',
// // // // //     justifyContent: 'center',
// // // // //     borderRadius: 10,
// // // // //     padding: 8,
// // // // //     marginBottom: 14,
// // // // //   },

// // // // //   toggleItem: {
// // // // //     flexDirection: 'row',
// // // // //     alignItems: 'center',
// // // // //     marginHorizontal: 10,
// // // // //   },

// // // // //   radioOuter: {
// // // // //     width: 16,
// // // // //     height: 16,
// // // // //     borderRadius: 8,
// // // // //     borderWidth: 2,
// // // // //     marginRight: 6,
// // // // //     alignItems: 'center',
// // // // //     justifyContent: 'center',
// // // // //   },

// // // // //   radioInner: {
// // // // //     width: 8,
// // // // //     height: 8,
// // // // //     borderRadius: 4,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // SECTION
// // // // //   // ==========================================================
// // // // //   section: {
// // // // //     fontWeight: '800',
// // // // //     marginBottom: 10,
// // // // //   },

// // // // //   noTasks: {
// // // // //     textAlign: 'center',
// // // // //     marginTop: 20,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // TASK CARD
// // // // //   // ==========================================================
// // // // //   card: {
// // // // //     borderRadius: 12,
// // // // //     padding: 14,
// // // // //     marginBottom: 12,
// // // // //     flexDirection: 'row',
// // // // //     justifyContent: 'space-between',
// // // // //     alignItems: 'center',
// // // // //     elevation: 3,
// // // // //   },

// // // // //   completedCard: {
// // // // //     opacity: 0.7,
// // // // //     borderLeftWidth: 4,
// // // // //     borderLeftColor: '#4CAF50',
// // // // //   },

// // // // //   cardLeft: {
// // // // //     flexDirection: 'row',
// // // // //     alignItems: 'center',
// // // // //     flex: 1,
// // // // //   },

// // // // //   clock: {
// // // // //     width: 40,
// // // // //     height: 40,
// // // // //     borderRadius: 20,
// // // // //     borderWidth: 2,
// // // // //     justifyContent: 'center',
// // // // //     alignItems: 'center',
// // // // //     marginRight: 10,
// // // // //   },

// // // // //   taskTitle: {
// // // // //     fontWeight: '800',
// // // // //   },

// // // // //   taskDate: {
// // // // //     fontSize: 11,
// // // // //     marginTop: 4,
// // // // //   },

// // // // //   completedText: {
// // // // //     textDecorationLine: 'line-through',
// // // // //   },

// // // // //   completedBadge: {
// // // // //     fontSize: 10,
// // // // //     color: '#4CAF50',
// // // // //     fontWeight: '700',
// // // // //     marginTop: 2,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // TASK ACTIONS
// // // // //   // ==========================================================
// // // // //   taskActions: {
// // // // //     flexDirection: 'row',
// // // // //     alignItems: 'center',
// // // // //     gap: 6,
// // // // //   },

// // // // //   editBtn: {
// // // // //     padding: 4,
// // // // //   },

// // // // //   checkbox: {
// // // // //     width: 22,
// // // // //     height: 22,
// // // // //     borderWidth: 1.5,
// // // // //     justifyContent: 'center',
// // // // //     alignItems: 'center',
// // // // //     borderRadius: 4,
// // // // //   },

// // // // //   checkboxDone: {
// // // // //     backgroundColor: '#4CAF50',
// // // // //     borderColor: '#4CAF50',
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // FAB
// // // // //   // ==========================================================
// // // // //   fab: {
// // // // //     position: 'absolute',
// // // // //     right: 20,
// // // // //     bottom: 140,
// // // // //     width: 60,
// // // // //     height: 60,
// // // // //     borderRadius: 30,
// // // // //     backgroundColor: '#6ED3E8',
// // // // //     justifyContent: 'center',
// // // // //     alignItems: 'center',
// // // // //   },

// // // // //   fabDisabled: {
// // // // //     opacity: 0.5,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // CATEGORY
// // // // //   // ==========================================================
// // // // //   categoryContainer: {
// // // // //     position: 'absolute',
// // // // //     bottom: 70,
// // // // //     width: '100%',
// // // // //   },

// // // // //   category: {
// // // // //     backgroundColor: '#EDEDED',
// // // // //     paddingVertical: 8,
// // // // //     paddingHorizontal: 16,
// // // // //     borderRadius: 12,
// // // // //     marginRight: 8,
// // // // //   },

// // // // //   activeCategory: {
// // // // //     backgroundColor: '#7DD4E8',
// // // // //   },

// // // // //   categoryText: {
// // // // //     fontWeight: '700',
// // // // //   },

// // // // //   smallAdd: {
// // // // //     width: 30,
// // // // //     height: 30,
// // // // //     borderRadius: 15,
// // // // //     backgroundColor: '#6ED3E8',
// // // // //     justifyContent: 'center',
// // // // //     alignItems: 'center',
// // // // //     marginTop: 3,
// // // // //   },

// // // // //   // ==========================================================
// // // // //   // BOTTOM NAV
// // // // //   // ==========================================================
// // // // //   bottom: {
// // // // //     position: 'absolute',
// // // // //     bottom: 0,
// // // // //     left: 0,
// // // // //     right: 0,
// // // // //     width: '109%',
// // // // //     height: 65,
// // // // //     flexDirection: 'row',
// // // // //     justifyContent: 'space-around',
// // // // //     alignItems: 'center',
// // // // //     paddingHorizontal: 10,
// // // // //   },

// // // // //   iconBtn: {
// // // // //     flex: 1,
// // // // //     alignItems: 'center',
// // // // //     justifyContent: 'center',
// // // // //   },
// // // // // });
