import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, ImageBackground, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { useAuth } from "../../src/auth";
import { cacheGet, cacheSet, cacheBust } from "../../src/cache";
import { colors, spacing, radius } from "../../src/theme";

const TRIP_BG = "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1200&auto=format&fit=crop";

type SavedTrip = {
  id: string;
  input: { destination: string; duration_days: number; budget: string; group_type: string };
  ai_plan: { headline?: string };
  created_at: string;
};

type Draft = {
  id: string;
  title: string;
  description?: string;
  cover_photo_base64?: string;
  days?: any[];
  nodes?: any[];
  updated_at?: string;
  created_at?: string;
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const diff = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [quests, setQuests] = useState<QuestSummary[]>(() => cacheGet<QuestSummary[]>("profile:quests") || []);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>(() => cacheGet<SavedTrip[]>("profile:trips") || []);
  const [drafts, setDrafts] = useState<Draft[]>(() => cacheGet<Draft[]>("profile:drafts") || []);
  const [savedQuests, setSavedQuests] = useState<QuestSummary[]>(() => cacheGet<QuestSummary[]>("profile:saved") || []);
  const [loading, setLoading] = useState(() => !cacheGet("profile:quests"));
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const [q, s, d, sv] = await Promise.all([
        api.get("/users/me/quests", { signal: ctrl.signal }),
        api.get("/users/me/saved-trips", { signal: ctrl.signal }),
        api.get("/users/me/drafts", { signal: ctrl.signal }),
        api.get("/users/me/saved", { signal: ctrl.signal }),
      ]);
      setQuests(q.data || []); cacheSet("profile:quests", q.data || [], 60);
      setSavedTrips(s.data || []); cacheSet("profile:trips", s.data || [], 60);
      setDrafts(d.data || []); cacheSet("profile:drafts", d.data || [], 30);
      setSavedQuests(sv.data || []); cacheSet("profile:saved", sv.data || [], 60);
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); return () => abortRef.current?.abort(); }, [load]));

  const totalLikes = quests.reduce((a, q) => a + (q.likes_count || 0), 0);

  const editDraft = (d: Draft) => router.push({ pathname: "/(tabs)/create", params: { id: d.id } });

  const deleteDraft = (d: Draft) => {
    Alert.alert(
      "Delete draft?",
      `“${d.title || "Untitled"}” will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/quests/${d.id}`);
              setDrafts((p) => p.filter((x) => x.id !== d.id));
              cacheBust("profile:");
              cacheBust("feed:"); cacheBust("explore:");
            } catch (e: any) {
              Alert.alert("Could not delete", e?.response?.data?.detail || "Try again");
            }
          },
        },
      ]
    );
  };

  const publishDraft = (d: Draft) => {
    const totalEntries = (d.days || []).reduce((a: number, x: any) => a + (x.entries?.length || 0), 0);
    if (!d.title?.trim() || totalEntries === 0) {
      Alert.alert("Add more first", "A draft needs a title and at least one entry to publish.");
      editDraft(d);
      return;
    }
    Alert.alert(
      "Publish draft?",
      `“${d.title}” will go live for the visibility you set.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              await api.put(`/quests/${d.id}`, { status: "published" });
              setDrafts((p) => p.filter((x) => x.id !== d.id));
              cacheBust("profile:"); cacheBust("feed:"); cacheBust("explore:");
              load();
              router.push(`/quest/${d.id}`);
            } catch (e: any) {
              Alert.alert("Could not publish", e?.response?.data?.detail || "Try again");
            }
          },
        },
      ]
    );
  };

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
                <Text style={styles.statNum}>{drafts.length}</Text>
                <Text style={styles.statLabel}>Drafts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{savedQuests.length}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{savedTrips.length}</Text>
                <Text style={styles.statLabel}>AI</Text>
              </View>
            </View>

            {drafts.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Draft Quests</Text>
                  <View style={styles.countPill}><Text style={styles.countPillText}>{drafts.length}</Text></View>
                </View>
                <Text style={styles.sectionSub}>Continue where you left off</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
                  {drafts.map((d) => {
                    const totalEntries = (d.days || []).reduce((a: number, x: any) => a + (x.entries?.length || 0), 0);
                    const cover = d.cover_photo_base64 ? (d.cover_photo_base64.startsWith("http") ? d.cover_photo_base64 : `data:image/jpeg;base64,${d.cover_photo_base64}`) : null;
                    return (
                      <TouchableOpacity key={d.id} testID={`draft-${d.id}`} activeOpacity={0.85} onPress={() => editDraft(d)} style={styles.draftCard}>
                        {cover ? (
                          <ImageBackground source={{ uri: cover }} style={styles.draftImg} imageStyle={{ borderRadius: radius.lg }}>
                            <View style={styles.tripOverlay} />
                            <View style={styles.draftBadge}>
                              <Ionicons name="bookmark" size={10} color={colors.primary} />
                              <Text style={styles.draftBadgeText}>DRAFT</Text>
                            </View>
                            <View style={styles.draftBody}>
                              <Text style={styles.draftTitle} numberOfLines={2}>{d.title || "Untitled draft"}</Text>
                              <Text style={styles.draftMeta} numberOfLines={1}>
                                {(d.days?.length || 0)} day{(d.days?.length || 0) === 1 ? "" : "s"} · {totalEntries} entr{totalEntries === 1 ? "y" : "ies"}
                              </Text>
                              <Text style={styles.draftWhen}>Last edited {timeAgo(d.updated_at || d.created_at)}</Text>
                            </View>
                          </ImageBackground>
                        ) : (
                          <View style={[styles.draftImg, { backgroundColor: colors.surface, justifyContent: "flex-end" }]}>
                            <View style={styles.draftBadge}>
                              <Ionicons name="bookmark" size={10} color={colors.primary} />
                              <Text style={styles.draftBadgeText}>DRAFT</Text>
                            </View>
                            <View style={styles.draftBody}>
                              <Text style={styles.draftTitle} numberOfLines={2}>{d.title || "Untitled draft"}</Text>
                              <Text style={styles.draftMeta} numberOfLines={1}>
                                {(d.days?.length || 0)} day{(d.days?.length || 0) === 1 ? "" : "s"} · {totalEntries} entr{totalEntries === 1 ? "y" : "ies"}
                              </Text>
                              <Text style={styles.draftWhen}>Last edited {timeAgo(d.updated_at || d.created_at)}</Text>
                            </View>
                          </View>
                        )}
                        <View style={styles.draftActions}>
                          <TouchableOpacity testID={`draft-edit-${d.id}`} style={styles.draftActionBtn} onPress={() => editDraft(d)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="create-outline" size={14} color={colors.text} />
                            <Text style={styles.draftActionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID={`draft-publish-${d.id}`} style={[styles.draftActionBtn, styles.draftActionPrimary]} onPress={() => publishDraft(d)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="send" size={12} color="#000" />
                            <Text style={styles.draftActionPrimaryText}>Publish</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID={`draft-delete-${d.id}`} style={styles.draftActionIcon} onPress={() => deleteDraft(d)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={14} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {savedQuests.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Ionicons name="bookmark" size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Saved Quests</Text>
                  <View style={styles.countPill}><Text style={styles.countPillText}>{savedQuests.length}</Text></View>
                </View>
                <Text style={styles.sectionSub}>Quests you bookmarked for later</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
                  {savedQuests.map((q) => {
                    const cover = q.cover_photo_base64
                      ? (q.cover_photo_base64.startsWith("http") ? q.cover_photo_base64 : `data:image/jpeg;base64,${q.cover_photo_base64}`)
                      : "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1200&auto=format&fit=crop";
                    return (
                      <TouchableOpacity
                        key={q.id}
                        testID={`saved-quest-${q.id}`}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/quest/${q.id}`)}
                        style={styles.savedCard}
                      >
                        <ImageBackground source={{ uri: cover }} style={styles.savedImg} imageStyle={{ borderRadius: radius.lg }}>
                          <View style={styles.tripOverlay} />
                          <View style={styles.savedBadge}>
                            <Ionicons name="bookmark" size={10} color={colors.primary} />
                            <Text style={styles.savedBadgeText}>SAVED</Text>
                          </View>
                          <View style={styles.savedBody}>
                            <Text style={styles.savedTitle} numberOfLines={2}>{q.title}</Text>
                            <Text style={styles.savedMeta} numberOfLines={1}>
                              by {q.author?.name || "Explorer"} · {q.nodes?.length || 0} stop{(q.nodes?.length || 0) === 1 ? "" : "s"}
                            </Text>
                            <View style={styles.savedStats}>
                              <Ionicons name="heart" size={11} color={colors.primary} />
                              <Text style={styles.savedStatText}>{q.likes_count}</Text>
                              <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                              <Text style={styles.savedStatText}>{q.comments_count}</Text>
                            </View>
                          </View>
                        </ImageBackground>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

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
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
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
  statsRow: { flexDirection: "row", gap: 8, marginTop: spacing.lg },
  statBox: {
    flex: 1, backgroundColor: colors.surface, paddingVertical: spacing.md, paddingHorizontal: 6,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  statNum: { color: colors.primary, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, letterSpacing: 0.8, textTransform: "uppercase" },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  sectionSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  countPill: {
    backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill,
    minWidth: 22, alignItems: "center",
  },
  countPillText: { color: "#000", fontSize: 11, fontWeight: "900" },

  draftCard: {
    width: 240, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  draftImg: { width: "100%", height: 130, justifyContent: "flex-end" },
  draftBadge: {
    position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary,
  },
  draftBadgeText: { color: colors.primary, fontWeight: "900", fontSize: 9, letterSpacing: 1 },
  draftBody: { padding: spacing.sm, backgroundColor: "rgba(0,0,0,0.55)" },
  draftTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
  draftMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  draftWhen: { color: colors.textMuted, fontSize: 10, marginTop: 2, fontStyle: "italic" },
  draftActions: {
    flexDirection: "row", alignItems: "center", gap: 6, padding: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  draftActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  draftActionText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  draftActionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary, flex: 1, justifyContent: "center" },
  draftActionPrimaryText: { color: "#000", fontSize: 11, fontWeight: "900" },
  draftActionIcon: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255, 75, 75, 0.08)", borderWidth: 1, borderColor: "rgba(255, 75, 75, 0.3)",
  },

  savedCard: {
    width: 220, height: 150, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  savedImg: { flex: 1, justifyContent: "flex-end" },
  savedBadge: {
    position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary,
  },
  savedBadgeText: { color: colors.primary, fontWeight: "900", fontSize: 9, letterSpacing: 1 },
  savedBody: { padding: spacing.sm, backgroundColor: "rgba(0,0,0,0.55)" },
  savedTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
  savedMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  savedStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  savedStatText: { color: colors.text, fontSize: 11, fontWeight: "700" },

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
