import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/api';

export const apiClient = async (endpoint, options = {}) => {
  try {
    // Get JWT token
    const token = await AsyncStorage.getItem('token');

    // Default headers
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Add Authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // API request
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return null;
    }

    // Read response as text first
    const text = await response.text();

    // Parse JSON if possible
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    // Unauthorized -> remove expired token
    if (response.status === 401) {
      await AsyncStorage.removeItem('token');
      throw new Error('Session expired. Please login again.');
    }

    // Other errors
    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
      );
    }

    return data;

  } catch (error) {
    console.error('API Client Error:', error);
    throw error;
  }
};