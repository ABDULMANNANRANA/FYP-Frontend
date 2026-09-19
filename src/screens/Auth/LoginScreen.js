import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import colors from "../../constants/colors";
import { BASE_URL } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";

const LoginScreen = ({ navigation }) => {
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid response received from server");
      }

      console.log("Login Response:", data);

      if (response.ok && data?.success) {
        const userData = data.data;

        if (!userData?.token) {
          Alert.alert("Login Failed", "Authentication token was not received.");
          return;
        }

        // Save token
        await AsyncStorage.setItem("token", userData.token);

        // Save user ID
        if (userData.userId !== undefined && userData.userId !== null) {
          await AsyncStorage.setItem(
            "userId",
            userData.userId.toString()
          );
        }

        // Save user name
        if (userData.fullName) {
          await AsyncStorage.setItem("userName", userData.fullName);
        }

        Alert.alert("Success", "Login Successful", [
          {
            text: "OK",
            onPress: () => navigation.replace("MainStack"),
          },
        ]);
      } else {
        Alert.alert(
          "Login Failed",
          data?.message || "Invalid email or password"
        );
      }
    } catch (error) {
      console.log("Login Error:", error);

      if (error?.message === "Network request failed") {
        Alert.alert(
          "Connection Error",
          "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
        );
      } else {
        Alert.alert(
          "Error",
          error?.message || "Server not reachable"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Safe color fallbacks for dark/light themes
  const textColor = theme?.text || "#0F172A";
  const subTextColor = theme?.subText || "#64748B";
  const backgroundColor = theme?.bg || "#F8FAFC";
  const primaryColor = theme?.primary || colors?.primary || "#2563EB";
  const inputBgColor = theme?.cardBg || "#FFFFFF";
  const borderColor = theme?.border || "#E2E8F0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar
        barStyle={theme?.dark ? "light-content" : "dark-content"}
        backgroundColor={backgroundColor}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Bar */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: inputBgColor, borderColor }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={textColor}
              />
            </TouchableOpacity>
          </View>

          {/* Hero / Title Section */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: textColor }]}>
              Welcome Back
            </Text>
            <Text style={[styles.subtitle, { color: subTextColor }]}>
              Sign in to continue to your account
            </Text>
          </View>

          {/* Form Container */}
          <View style={styles.form}>
            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: textColor }]}>
                EMAIL ADDRESS
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: inputBgColor, borderColor },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={subTextColor}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="name@example.com"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { color: textColor }]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: textColor }]}>
                PASSWORD
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: inputBgColor, borderColor },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={subTextColor}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { color: textColor }]}
                  secureTextEntry={secure}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setSecure(!secure)}
                  style={styles.eyeButton}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={secure ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={subTextColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotContainer}
              onPress={() => {
                // Add forgot password navigation here if available
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.forgotText, { color: primaryColor }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: primaryColor },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>LOG IN</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: subTextColor }]}>
              Don't have an account?{" "}
              <Text
                style={[styles.registerText, { color: primaryColor }]}
                onPress={() => navigation.navigate("Register")}
              >
                Register now
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  header: {
    height: 48,
    justifyContent: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  form: {
    width: "100%",
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    height: "100%",
  },
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },
  forgotContainer: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 28,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    height: 54,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 32,
    alignItems: "center",
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 14,
  },
  registerText: {
    fontWeight: "700",
  },
});

























// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   StyleSheet,
//   SafeAreaView,
//   TouchableOpacity,
//   TextInput,
//   Alert,
//   ActivityIndicator,
// } from "react-native";
// import Ionicons from "@react-native-vector-icons/ionicons";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// import colors from "../../constants/colors";
// import { BASE_URL } from "../../config/api";
// import { useTheme } from "../../context/ThemeContext";

// const LoginScreen = ({ navigation }) => {
//   const { theme } = useTheme();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [secure, setSecure] = useState(true);
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async () => {
//     if (!email.trim() || !password) {
//       Alert.alert("Error", "Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const response = await fetch(`${BASE_URL}/auth/login`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//         body: JSON.stringify({
//           email: email.trim(),
//           password: password,
//         }),
//       });

//       let data;

//       try {
//         data = await response.json();
//       } catch (jsonError) {
//         throw new Error("Invalid response received from server");
//       }

//       console.log("Login Response:", data);

//       if (response.ok && data?.success) {
//         const userData = data.data;

//         if (!userData?.token) {
//           Alert.alert("Login Failed", "Authentication token was not received.");
//           return;
//         }

//         // Save token
//         await AsyncStorage.setItem("token", userData.token);

//         // Save user ID
//         if (userData.userId !== undefined && userData.userId !== null) {
//           await AsyncStorage.setItem(
//             "userId",
//             userData.userId.toString()
//           );
//         }

//         // Save user name
//         if (userData.fullName) {
//           await AsyncStorage.setItem("userName", userData.fullName);
//         }

//         Alert.alert("Success", "Login Successful", [
//           {
//             text: "OK",
//             onPress: () => navigation.replace("MainStack"),
//           },
//         ]);
//       } else {
//         Alert.alert(
//           "Login Failed",
//           data?.message || "Invalid email or password"
//         );
//       }
//     } catch (error) {
//       console.log("Login Error:", error);

//       if (error?.message === "Network request failed") {
//         Alert.alert(
//           "Connection Error",
//           "Unable to connect to the server. Please make sure the API is running and BASE_URL is correct."
//         );
//       } else {
//         Alert.alert(
//           "Error",
//           error?.message || "Server not reachable"
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
//         { backgroundColor: theme.bg },
//       ]}
//     >
//       {/* Back Button */}
//       <TouchableOpacity
//         style={styles.backButton}
//         onPress={() => navigation.goBack()}
//       >
//         <Ionicons
//           name="arrow-left"
//           size={24}
//           color={theme.text}
//         />
//       </TouchableOpacity>

//       {/* Title */}
//       <Text style={[styles.title, { color: theme.text }]}>
//         LOGIN
//       </Text>

//       {/* Email */}
//       <Text style={[styles.label, { color: theme.text }]}>
//         EMAIL
//       </Text>

//       <View style={styles.inputContainer}>
//         <Ionicons name="mail" size={18} color="#333" />

//         <TextInput
//           placeholder="Enter your email"
//           placeholderTextColor="#777"
//           style={styles.input}
//           value={email}
//           onChangeText={setEmail}
//           keyboardType="email-address"
//           autoCapitalize="none"
//           autoCorrect={false}
//         />
//       </View>

//       {/* Password */}
//       <Text style={[styles.label, { color: theme.text }]}>
//         PASSWORD
//       </Text>

//       <View style={[styles.inputContainer, styles.passwordBox]}>
//         <Ionicons name="lock" size={18} color="#333" />

//         <TextInput
//           placeholder="Password"
//           placeholderTextColor="#777"
//           style={styles.input}
//           secureTextEntry={secure}
//           value={password}
//           onChangeText={setPassword}
//           autoCapitalize="none"
//           autoCorrect={false}
//         />

//         <TouchableOpacity
//           onPress={() => setSecure(!secure)}
//           style={styles.eyeButton}
//         >
//           <Ionicons
//             name={secure ? "eye-off" : "eye"}
//             size={18}
//             color="#333"
//           />
//         </TouchableOpacity>
//       </View>

//       {/* Forgot Password */}
//       <TouchableOpacity
//         style={styles.forgotContainer}
//         onPress={() => {
//           // Add forgot password navigation here if available
//         }}
//       >
//         <Text
//           style={[
//             styles.forgotText,
//             { color: theme.text },
//           ]}
//         >
//           Forgot Password?
//         </Text>
//       </TouchableOpacity>

//       {/* Login Button */}
//       <TouchableOpacity
//         style={[
//           styles.button,
//           loading && styles.buttonDisabled,
//         ]}
//         onPress={handleLogin}
//         disabled={loading}
//       >
//         {loading ? (
//           <ActivityIndicator color="#fff" />
//         ) : (
//           <Text style={styles.buttonText}>
//             LOGIN
//           </Text>
//         )}
//       </TouchableOpacity>

//       {/* Register */}
//       <View style={styles.footer}>
//         <Text
//           style={[
//             styles.footerText,
//             { color: theme.text },
//           ]}
//         >
//           Don't have an account?{" "}

//           <Text
//             style={styles.registerText}
//             onPress={() => navigation.navigate("Register")}
//           >
//             Register now
//           </Text>
//         </Text>
//       </View>
//     </SafeAreaView>
//   );
// };

// export default LoginScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 20,
//   },

//   backButton: {
//     alignSelf: "flex-start",
//     padding: 4,
//   },

//   title: {
//     textAlign: "center",
//     fontSize: 22,
//     fontWeight: "700",
//     marginVertical: 30,
//     letterSpacing: 2,
//   },

//   label: {
//     fontSize: 12,
//     fontWeight: "700",
//     marginBottom: 8,
//     backgroundColor: "#EDEDED",
//     alignSelf: "flex-start",
//     paddingHorizontal: 6,
//     paddingVertical: 2,
//     marginTop: 20,
//   },

//   inputContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     borderWidth: 1,
//     borderColor: "#999",
//     borderRadius: 30,
//     paddingHorizontal: 15,
//     height: 50,
//     backgroundColor: "#D9DEE4",
//   },

//   passwordBox: {
//     justifyContent: "space-between",
//   },

//   input: {
//     flex: 1,
//     marginLeft: 10,
//     color: "#000",
//   },

//   eyeButton: {
//     padding: 5,
//   },

//   forgotContainer: {
//     alignItems: "center",
//     marginTop: 20,
//   },

//   forgotText: {
//     fontSize: 13,
//     fontWeight: "500",
//   },

//   button: {
//     backgroundColor: "#000",
//     marginTop: 30,
//     borderRadius: 30,
//     height: 50,
//     justifyContent: "center",
//     alignItems: "center",
//     elevation: 4,
//   },

//   buttonDisabled: {
//     opacity: 0.7,
//   },

//   buttonText: {
//     color: "#fff",
//     fontWeight: "700",
//     letterSpacing: 1,
//   },

//   footer: {
//     marginTop: 30,
//     alignItems: "center",
//   },

//   footerText: {
//     fontSize: 13,
//   },

//   registerText: {
//     color: "#2F80ED",
//     fontWeight: "600",
//   },
// });
