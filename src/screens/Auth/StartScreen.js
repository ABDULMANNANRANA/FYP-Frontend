import React, { useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";

import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native";

const StartScreen = ({ navigation }) => {
  const { isDark, theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace("Login"); // go to login after splash
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation]);

  // Safe Fallbacks for Theme Colors
  const backgroundColor = theme?.bg || "#F8FAFC";
  const textColor = theme?.text || "#0F172A";
  const subTextColor = theme?.subText || "#64748B";
  const cardBg = theme?.cardBg || "#FFFFFF";
  const primaryColor = theme?.primary || "#2563EB";
  const borderColor = theme?.border || "#E2E8F0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={backgroundColor}
        translucent={Platform.OS === "android"}
      />

      <View style={styles.mainWrapper}>
        {/* Central Branding Section */}
        <View style={styles.content}>
          <View
            style={[
              styles.logoCard,
              { backgroundColor: cardBg, borderColor },
            ]}
          >
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.title, { color: textColor }]}>TODO-LIST</Text>
          <Text style={[styles.subtitle, { color: subTextColor }]}>
            Smart Alerts & Task Manager
          </Text>
        </View>

        {/* Bottom Loading Indicator */}
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={primaryColor} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default StartScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  logoCard: {
    width: 130,
    height: 130,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  footer: {
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});





















// import React, { useEffect } from "react";
// import { useTheme } from '../../context/ThemeContext';

// import {
//   View,
//   StyleSheet,
//   Image,
//   SafeAreaView,
// } from "react-native";


// const StartScreen = ({ navigation }) => {
//   const { isDark, theme } = useTheme();


//   useEffect(() => {
//     const timer = setTimeout(() => {
//       navigation.replace("Login"); // go to login after splash
//     }, 2500);

//     return () => clearTimeout(timer);
//   }, [navigation]);

//   return (
//     <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
//       <View style={styles.content}>
        
//         <Image
//           source={require("../../assets/logo.png")} // place your logo here
//           style={styles.logo}
//           resizeMode="contain"
//         />

//         {/* <Text style={[styles.title, { color: theme.text }, { color: theme.text }]}>TODO-LIST</Text>
//         <Text style={[styles.subtitle, { color: theme.text }, { color: theme.text }]}>Smart Alerts</Text> */}

//       </View>
//     </SafeAreaView>
//   );
// };

// export default StartScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#EAF2FF", // light gradient-like bg
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   content: {
//     alignItems: "center",
//   },
//   logo: {
//     width: 120,
//     height: 120,
//     marginBottom: 20,
//   },
//   title: {
//     fontSize: 28,
//     fontWeight: "700",
//     color: "#1F3C88",
//     letterSpacing: 1,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: "#6B7A99",
//     marginTop: 4,
//   },
// });