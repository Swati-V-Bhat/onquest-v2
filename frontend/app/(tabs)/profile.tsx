import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { useAuth } from "../../src/auth";
import { colors, spacing, radius } from "../../src/theme";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/users/me/quests");
      setQuests(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalLikes = quests.reduce((a, q) => a + (q.likes_count || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        testID="profile-list"
        ListHeaderComponent={
          <View style={{ padding: spacing.md }}>
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace("/auth/login"); }}>
                <Ionicons name="log-out-outline" size={18} color={colors.text} />
                <Text style={styles.logoutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{quests.length}</Text>
                <Text style={styles.statLabel}>Quests</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{totalLikes}</Text>
                <Text style={styles.statLabel}>Likes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{quests.reduce((a, q) => a + (q.nodes?.length || 0), 0)}</Text>
                <Text style={styles.statLabel}>Stops</Text>
              </View>
            </View>

            <Text style={[styles.overline, { marginTop: spacing.lg }]}>YOUR QUESTS</Text>
          </View>
        }
        data={quests}
        keyExtractor={(q) => q.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
        renderItem={({ item }) => <QuestCard quest={item} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.center}>
              <Ionicons name="map-outline" size={48} color={colors.textMuted} />
              <Text style={styles.empty}>No quests yet. Tap Create to start.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  avatarText: { color: "#000", fontWeight: "900", fontSize: 28 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  logoutText: { color: colors.text, fontWeight: "700" },
  name: { color: colors.text, fontSize: 28, fontWeight: "900", marginTop: spacing.md, letterSpacing: -0.5 },
  email: { color: colors.textSecondary, marginTop: 2 },
  bio: { color: colors.text, marginTop: spacing.sm },
  statsRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  statBox: {
    flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  statNum: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 2, letterSpacing: 1, textTransform: "uppercase" },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.textSecondary, marginTop: spacing.md },
});
