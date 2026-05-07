import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { useAuth } from "../../src/auth";
import { colors, spacing, radius } from "../../src/theme";

const TRIP_BG = "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1200&auto=format&fit=crop";

type SavedTrip = {
  id: string;
  input: { destination: string; duration_days: number; budget: string; group_type: string };
  ai_plan: { headline?: string };
  created_at: string;
};

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([
        api.get("/users/me/quests"),
        api.get("/users/me/saved-trips"),
      ]);
      setQuests(q.data || []);
      setSavedTrips(s.data || []);
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
                <Text style={styles.statNum}>{savedTrips.length}</Text>
                <Text style={styles.statLabel}>AI Trips</Text>
              </View>
            </View>

            {savedTrips.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Ionicons name="sparkles" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Saved AI Trips</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
                  {savedTrips.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      testID={`saved-trip-${t.id}`}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/ai/saved/${t.id}`)}
                      style={styles.tripCard}
                    >
                      <ImageBackground source={{ uri: TRIP_BG }} style={styles.tripImg} imageStyle={{ borderRadius: radius.lg }}>
                        <View style={styles.tripOverlay} />
                        <View style={styles.tripBadge}><Ionicons name="sparkles" size={11} color={colors.primary} /><Text style={styles.tripBadgeText}>AI</Text></View>
                        <View style={styles.tripBody}>
                          <Text style={styles.tripDest} numberOfLines={1}>{t.input.destination}</Text>
                          <Text style={styles.tripHead} numberOfLines={2}>{t.ai_plan?.headline || "AI itinerary"}</Text>
                          <Text style={styles.tripMeta}>{t.input.duration_days} days · {t.input.group_type} · {t.input.budget}</Text>
                        </View>
                      </ImageBackground>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

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
              <Text style={styles.empty}>No quests yet. Tap Post to start.</Text>
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
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  tripCard: {
    width: 240, height: 160, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tripImg: { flex: 1, justifyContent: "flex-end" },
  tripOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  tripBadge: {
    position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  tripBadgeText: { color: colors.primary, fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  tripBody: { padding: spacing.md, backgroundColor: "rgba(0,0,0,0.55)" },
  tripDest: { color: colors.primary, fontWeight: "800", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  tripHead: { color: colors.text, fontWeight: "800", marginTop: 4, fontSize: 14 },
  tripMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.textSecondary, marginTop: spacing.md },
});
