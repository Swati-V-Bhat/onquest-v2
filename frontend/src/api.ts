import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 90000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("oq_token");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { BACKEND_URL };
