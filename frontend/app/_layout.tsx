import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, LogBox } from "react-native";
import { AuthProvider } from "../src/auth";

if (Platform.OS !== "web") {
  LogBox.ignoreLogs(["6000ms timeout exceeded", "FontFaceObserver"]);
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const orig = window.onerror;
      window.onerror = (msg, ...rest) => {
        if (typeof msg === "string" && /timeout exceeded/i.test(msg)) return true;
        return typeof orig === "function" ? (orig as any)(msg, ...rest) : false;
      };
      const onRej = (e: PromiseRejectionEvent) => {
        const m = e?.reason?.message || "";
        if (/timeout exceeded/i.test(String(m))) {
          e.preventDefault();
        }
      };
      window.addEventListener("unhandledrejection", onRej);
      return () => window.removeEventListener("unhandledrejection", onRej);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0A0A0A" },
              animation: "fade",
            }}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
