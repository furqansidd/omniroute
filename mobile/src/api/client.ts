import Constants from 'expo-constants';

const getApiBaseUrl = () => {
  // 1. If web browser
  if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:5000/api/v1`;
  }

  // 2. Dynamic Expo host IP for physical mobile phones & emulators
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api/v1`;
    }
  }

  // 3. Fallback to computer local Wi-Fi IP
  return 'http://192.168.0.249:5000/api/v1';
};

export const BASE_URL = getApiBaseUrl();

let globalAuthToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  globalAuthToken = token;
};

export const getAuthToken = () => globalAuthToken;

export const mobileApiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (globalAuthToken) {
    headers['Authorization'] = `Bearer ${globalAuthToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || 'Non-JSON response received' };
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: Request failed`);
    }

    return data;
  } catch (err: any) {
    throw new Error(err.message || `Network request failed to ${BASE_URL}`);
  }
};
