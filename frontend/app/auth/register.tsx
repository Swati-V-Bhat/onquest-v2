import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator, ScrollView, Image,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { colors, spacing, radius } from "../../src/theme";

const BG = "https://static.prod-images.emergentagent.com/jobs/8adc407e-78d5-4c4a-a0ab-529e6e00cf8a/images/a238f86d957f876ba9518cb174f6b8b214738206984cd6be59dbdcdffeaa7c3a.png";
const BRAND_LOGO = require("../../assets/images/quest-icon.png");

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Name, valid email & 6+ char password required");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)/feed");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not register. Try a different email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={{ uri: BG }} style={styles.bg} imageStyle={{ opacity: 0.18 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={BRAND_LOGO} style={styles.logoImg} resizeMode="contain" />
            <Text style={styles.brandText}>Join OnQuest</Text>
            <Text style={styles.tagline}>Become an explorer</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Create your traveler ID</Text>
            <Text style={styles.subtitle}>Document and share your adventures</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput testID="reg-name-input" style={styles.input} placeholder="Your name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

            <Text style={styles.label}>Email</Text>
            <TextInput testID="reg-email-input" style={styles.input} placeholder="you@onquest.in" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />

            <Text style={styles.label}>Password</Text>
            <TextInput testID="reg-password-input" style={styles.input} placeholder="6+ characters" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity testID="reg-submit-btn" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Start Exploring</Text>}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.muted}>Already a traveler?</Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity testID="goto-login-btn"><Text style={styles.link}>  Sign in</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  logoImg: { width: 64, height: 64, tintColor: colors.primary, marginBottom: spacing.md },
  logoDot: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  brandText: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  tagline: { color: colors.textSecondary, marginTop: 6, letterSpacing: 1.5, fontSize: 11, textTransform: "uppercase" },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.md, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  input: {
    backgroundColor: colors.bg, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  error: { color: colors.danger, marginTop: spacing.md },
  primaryBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.pill,
    alignItems: "center",
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: { color: "#000", fontWeight: "800", letterSpacing: 0.5 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  muted: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
});
