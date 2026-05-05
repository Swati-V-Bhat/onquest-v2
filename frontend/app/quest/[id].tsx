import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../src/api";
import QuestMap from "../../src/QuestMap";
import { useAuth } from "../../src/auth";
import { colors, spacing, radius } from "../../src/theme";

const FALLBACK = "https://images.unsplash.com/photo-1739369984570-aff23bb45d9a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHx0cmF2ZWxlciUyMG1vdW50YWluJTIwYWR2ZW50dXJlJTIwc3Vuc2V0fGVufDB8fHx8MTc3Nzk5NDQyN3ww&ixlib=rb-4.1.0&q=85";

export default function QuestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [quest, setQuest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/quests/${id}`);
      setQuest(data);
    } catch {} finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onLike = async () => {
    try {
      const { data } = await api.post(`/quests/${id}/like`);
      setQuest((q: any) => ({ ...q, likes_count: data.likes_count, liked: data.liked }));
    } catch (e: any) {
      Alert.alert("Login required");
    }
  };

  const onComment = async () => {
    if (!comment.trim()) return;
    try {
      const { data } = await api.post(`/quests/${id}/comment`, { text: comment.trim() });
      setQuest((q: any) => ({ ...q, comments: [...(q.comments || []), data], comments_count: (q.comments_count || 0) + 1 }));
      setComment("");
    } catch {
      Alert.alert("Login required to comment");
    }
  };

  const onAiSummary = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post(`/quests/${id}/ai-summary`);
      setQuest((q: any) => ({ ...q, ai_summary: data.ai_summary }));
    } catch (e: any) {
      Alert.alert("AI summary", e?.response?.data?.detail || "Failed");
    } finally { setAiLoading(false); }
  };

  if (loading || !quest) {
    return (
      <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
    );
  }

  const cover = quest.cover_photo_base64
    ? (quest.cover_photo_base64.startsWith("http") ? quest.cover_photo_base64 : `data:image/jpeg;base64,${quest.cover_photo_base64}`)
    : FALLBACK;
  const points = (quest.nodes || [])
    .filter((n: any) => typeof n.lat === "number" && typeof n.lng === "number")
    .map((n: any, i: number) => ({ lat: n.lat, lng: n.lng, title: n.title, order: i }));

  const isAuthor = user?.id === quest.author?.id;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View>
            <Image source={{ uri: cover }} style={styles.hero} />
            <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.heroOverlay}>
              <View style={styles.badge}>
                <Ionicons name="git-network-outline" size={12} color={colors.primary} />
                <Text style={styles.badgeText}>{quest.nodes?.length || 0} STOPS</Text>
              </View>
              <Text style={styles.title}>{quest.title}</Text>
              <View style={styles.authorRow}>
                <View style={styles.avatarSm}><Text style={styles.avatarSmText}>{(quest.author?.name || "?").charAt(0).toUpperCase()}</Text></View>
                <Text style={styles.authorName}>{quest.author?.name}</Text>
              </View>
            </View>
          </View>

          <View style={{ padding: spacing.md }}>
            {quest.description ? <Text style={styles.desc}>{quest.description}</Text> : null}

            <View style={styles.actionsRow}>
              <TouchableOpacity testID="like-btn" style={styles.actionBtn} onPress={onLike}>
                <Ionicons name="heart" size={18} color={colors.primary} />
                <Text style={styles.actionText}>{quest.likes_count || 0} Likes</Text>
              </TouchableOpacity>
              <View style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
                <Text style={styles.actionText}>{quest.comments_count || 0} Comments</Text>
              </View>
            </View>

            {points.length > 0 && (
              <>
                <Text style={[styles.overline, { marginTop: spacing.md }]}>JOURNEY MAP</Text>
                <View style={{ marginTop: spacing.sm }}>
                  <QuestMap points={points} height={260} />
                </View>
              </>
            )}

            <View style={styles.aiBox}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.overline}>AI TRAVEL SUMMARY</Text>
              </View>
              {quest.ai_summary ? (
                <Text style={styles.aiText}>{quest.ai_summary}</Text>
              ) : (
                <Text style={styles.aiPlaceholder}>{isAuthor ? "Generate a poetic summary of this quest." : "Author hasn't generated a summary yet."}</Text>
              )}
              {isAuthor && (
                <TouchableOpacity testID="ai-summary-btn" style={styles.aiBtn} onPress={onAiSummary} disabled={aiLoading}>
                  {aiLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.aiBtnText}>{quest.ai_summary ? "Regenerate" : "Generate Summary"}</Text>}
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.overline, { marginTop: spacing.lg }]}>FLOWCHART</Text>

            {(quest.nodes || []).map((n: any, idx: number) => (
              <View key={n.id} style={styles.nodeWrap}>
                {idx > 0 && <View style={styles.connector} />}
                <View style={[styles.node, n.type === "activity" && styles.nodeAlt]}>
                  <View style={styles.nodeHeader}>
                    <View style={styles.nodeBadge}><Text style={styles.nodeBadgeText}>{idx + 1}</Text></View>
                    <Text style={styles.nodeType}>{(n.type || "place").toUpperCase()}</Text>
                  </View>
                  <Text style={styles.nodeTitle}>{n.title}</Text>
                  {n.location_name ? (
                    <View style={styles.locRow}>
                      <Ionicons name="location-outline" size={13} color={colors.primary} />
                      <Text style={styles.locText}>{n.location_name}</Text>
                    </View>
                  ) : null}
                  {n.description ? <Text style={styles.nodeDesc}>{n.description}</Text> : null}
                  {n.photo_base64 ? (
                    <Image source={{ uri: n.photo_base64.startsWith("http") ? n.photo_base64 : `data:image/jpeg;base64,${n.photo_base64}` }} style={styles.nodeImg} />
                  ) : null}
                </View>
              </View>
            ))}

            <Text style={[styles.overline, { marginTop: spacing.lg }]}>COMMENTS</Text>
            {(quest.comments || []).map((c: any) => (
              <View key={c.id} style={styles.commentItem}>
                <View style={styles.avatarSm}><Text style={styles.avatarSmText}>{(c.user?.name || "?").charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentName}>{c.user?.name}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
            {(quest.comments || []).length === 0 && (
              <Text style={styles.emptyComments}>Be the first to comment.</Text>
            )}

            <View style={styles.commentBox}>
              <TextInput
                testID="comment-input"
                style={styles.commentInput}
                placeholder="Share your thoughts…"
                placeholderTextColor={colors.textMuted}
                value={comment}
                onChangeText={setComment}
              />
              <TouchableOpacity testID="comment-submit" style={styles.commentSend} onPress={onComment}>
                <Ionicons name="send" size={18} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hero: { width: "100%", height: 320 },
  backBtn: {
    position: "absolute", top: 12, left: 12, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  heroOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  badgeText: { color: colors.primary, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  authorRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  avatarSm: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarSmText: { color: "#000", fontWeight: "900" },
  authorName: { color: colors.text, fontWeight: "700" },
  desc: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  actionText: { color: colors.text, fontWeight: "700" },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  aiBox: {
    marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  aiText: { color: colors.text, marginTop: spacing.sm, lineHeight: 22 },
  aiPlaceholder: { color: colors.textSecondary, marginTop: spacing.sm },
  aiBtn: {
    marginTop: spacing.md, alignSelf: "flex-start",
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  aiBtnText: { color: "#000", fontWeight: "800" },
  nodeWrap: { marginTop: spacing.md },
  connector: { width: 2, height: 22, backgroundColor: colors.primarySoft, alignSelf: "center", marginBottom: 4, borderRadius: 2 },
  node: {
    backgroundColor: colors.surfaceElevated, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  nodeAlt: { borderColor: colors.primarySoft },
  nodeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  nodeBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  nodeBadgeText: { color: "#000", fontWeight: "900" },
  nodeType: { color: colors.primary, fontWeight: "800", letterSpacing: 1.2, fontSize: 11 },
  nodeTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locText: { color: colors.textSecondary, fontSize: 12 },
  nodeDesc: { color: colors.textSecondary, marginTop: 6 },
  nodeImg: { width: "100%", height: 180, marginTop: spacing.sm, borderRadius: radius.md },
  commentItem: {
    flexDirection: "row", gap: 10, padding: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  commentName: { color: colors.text, fontWeight: "800" },
  commentText: { color: colors.textSecondary, marginTop: 2 },
  emptyComments: { color: colors.textMuted, marginTop: spacing.sm },
  commentBox: { flexDirection: "row", marginTop: spacing.md, gap: 8 },
  commentInput: {
    flex: 1, backgroundColor: colors.surface, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  commentSend: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
});
