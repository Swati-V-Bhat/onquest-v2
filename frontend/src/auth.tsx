import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  bio?: string;
  avatar?: string;
};

type AuthCtx = {
  user: User | null | undefined; // undefined = loading
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("oq_token");
      if (!t) {
        setUser(null);
        return;
      }
      setToken(t);
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        await AsyncStorage.removeItem("oq_token");
        setUser(null);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem("oq_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    await AsyncStorage.setItem("oq_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("oq_token");
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, token, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
