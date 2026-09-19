import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const storedTheme = await AsyncStorage.getItem('appTheme');
      if (storedTheme !== null) {
        setIsDark(storedTheme === 'dark');
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const toggleTheme = async (value) => {
    try {
      setIsDark(value);
      await AsyncStorage.setItem('appTheme', value ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const theme = {
    bg: isDark ? '#1E1E1E' : '#B7C9DB',
    text: isDark ? '#FFFFFF' : '#000000',
    card: isDark ? '#2C2C2C' : '#EDEDED',
    bottomNav: isDark ? '#121212' : '#3A3F45',
    activeTab: isDark ? '#333333' : '#FFFFFF',
    primaryBtn: isDark ? '#4A4A4A' : '#000000',
    headerBox: isDark ? '#333333' : '#FFFFFF',
    filterBg: isDark ? '#444444' : '#6EC1D6',
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
