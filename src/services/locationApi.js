import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../config/api';

/**
 * Small fetch wrapper, used only by the location feature.
 *
 * Deliberately self-contained: it uses the same plain fetch + Bearer token
 * pattern as the rest of the app, so the feature can be dropped in without
 * changing any existing file.
 *
 * On failure it throws an Error carrying:
 *   error.isSessionExpired  -> the 401 case (token cleared, send to Login)
 *   error.kind === 'network'-> the server could not be reached
 */

const request = async (endpoint, { method = 'GET', body } = {}) => {
  const token = await AsyncStorage.getItem('token');

  if (!token) {
    const error = new Error('Session Expired. Please login again.');
    error.isSessionExpired = true;
    throw error;
  }

  let response;

  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkFailure) {
    const error = new Error(
      'Could not reach the server. Check that the API is running.'
    );
    error.kind = 'network';
    throw error;
  }

  let data = null;

  try {
    const text = await response.text();

    if (text) {
      data = JSON.parse(text);
    }
  } catch (parseFailure) {
    data = null;
  }

  if (response.status === 401) {
    await AsyncStorage.removeItem('token');

    const error = new Error('Session Expired. Please login again.');
    error.isSessionExpired = true;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.title ||
        data?.error ||
        `Request failed (${response.status}).`
    );

    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

export const getJson = endpoint => request(endpoint);

export const postJson = (endpoint, body) =>
  request(endpoint, { method: 'POST', body });

export const putJson = (endpoint, body) =>
  request(endpoint, { method: 'PUT', body });




























// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { BASE_URL } from '../config/api';

// /**
//  * Small fetch wrapper, used only by the location feature.
//  *
//  * Deliberately self-contained: it uses the same plain fetch + Bearer token
//  * pattern as the rest of the app, so the feature can be dropped in without
//  * changing any existing file.
//  *
//  * On failure it throws an Error carrying:
//  *   error.isSessionExpired  -> the 401 case (token cleared, send to Login)
//  *   error.kind === 'network'-> the server could not be reached
//  */

// const request = async (endpoint, { method = 'GET', body } = {}) => {
//   const token = await AsyncStorage.getItem('token');

//   if (!token) {
//     const error = new Error('Session Expired. Please login again.');
//     error.isSessionExpired = true;
//     throw error;
//   }

//   let response;

//   try {
//     response = await fetch(`${BASE_URL}${endpoint}`, {
//       method,
//       headers: {
//         Accept: 'application/json',
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${token}`,
//       },
//       body: body ? JSON.stringify(body) : undefined,
//     });
//   } catch (networkFailure) {
//     const error = new Error(
//       'Could not reach the server. Check that the API is running.'
//     );
//     error.kind = 'network';
//     throw error;
//   }

//   let data = null;

//   try {
//     const text = await response.text();

//     if (text) {
//       data = JSON.parse(text);
//     }
//   } catch (parseFailure) {
//     data = null;
//   }

//   if (response.status === 401) {
//     await AsyncStorage.removeItem('token');

//     const error = new Error('Session Expired. Please login again.');
//     error.isSessionExpired = true;
//     throw error;
//   }

//   if (!response.ok) {
//     const error = new Error(
//       data?.message ||
//         data?.title ||
//         data?.error ||
//         `Request failed (${response.status}).`
//     );

//     error.status = response.status;
//     error.payload = data;
//     throw error;
//   }

//   return data;
// };

// export const getJson = endpoint => request(endpoint);

// export const postJson = (endpoint, body) =>
//   request(endpoint, { method: 'POST', body });

// export const putJson = (endpoint, body) =>
//   request(endpoint, { method: 'PUT', body });
