import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Platform, Share, Modal, InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../src/api";
import QuestMap from "../../src/QuestMap";
import { useAuth } from "../../src/auth";
import { cacheBust } from "../../src/cache";
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mountMap, setMountMap] = useState(false);

  const load = useCallback(async () => {
    const ctrl = new AbortController();
    try {
      const { data } = await api.get(`/quests/${id}`, { signal: ctrl.signal });
      setQuest(data);
    } catch {} finally { setLoading(false); }
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Defer heavy WebView map mount until after first paint + interactions
  useEffect(() => {
    if (!quest || mountMap) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => setMountMap(true), 80);
    });
    return () => handle.cancel?.();
  }, [quest, mountMap]);

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

  const onShare = async () => {
    if (!quest) return;
    try {
      const stops = quest.nodes?.length || 0;
      const message = `${quest.title} — ${stops} stop${stops === 1 ? "" : "s"} on OnQuest by ${quest.author?.name || "a traveller"}.\nDiscover the full journey on OnQuest.`;
      await Share.share({ title: quest.title, message });
    } catch {}
  };

  const onEdit = () => {
    setActionsOpen(false);
    router.push({ pathname: "/(tabs)/create", params: { id: quest.id } });
  };

  const onDelete = () => {
    setActionsOpen(false);
    Alert.alert(
      "Delete this quest?",
      "This permanently removes your quest and all its stops, photos and comments. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/quests/${quest.id}`);
              cacheBust("feed:"); cacheBust("explore:"); cacheBust("profile:");
              router.replace("/(tabs)/feed");
            } catch (e: any) {
              Alert.alert("Could not delete", e?.response?.data?.detail || "Try again");
            } finally { setDeleting(false); }
          },
        },
      ]
    );
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
            <TouchableOpacity testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.heroActions}>
              <TouchableOpacity testID="share-btn" style={styles.iconBtnRight} onPress={onShare}>
                <Ionicons name="share-outline" size={20} color={colors.text} />
              </TouchableOpacity>
              {isAuthor && (
                <TouchableOpacity testID="owner-menu-btn" style={styles.iconBtnRight} onPress={() => setActionsOpen(true)}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
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
              <TouchableOpacity testID="share-btn-inline" style={styles.actionBtn} onPress={onShare}>
                <Ionicons name="share-social-outline" size={16} color={colors.text} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>

            {points.length > 0 && (
              <>
                <Text style={[styles.overline, { marginTop: spacing.md }]}>JOURNEY MAP</Text>
                <View style={{ marginTop: spacing.sm }}>
                  {mountMap ? (
                    <QuestMap points={points} height={260} />
                  ) : (
                    <View style={styles.mapPlaceholder}>
                      <Ionicons name="map-outline" size={28} color={colors.primary} />
                      <Text style={styles.mapPlaceholderText}>Loading map…</Text>
                    </View>
                  )}
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

            <Text style={[styles.overline, { marginTop: spacing.lg }]}>TIMELINE</Text>

            {(() => {
              const days = (quest.days && quest.days.length > 0)
                ? quest.days
                : [{ id: "legacy", title: "", description: "", date: "", entries: (quest.nodes || []).map((n: any) => ({
                    id: n.id, kind: n.type || "place", title: n.title, description: n.description,
                    photos: n.photo_base64 ? [n.photo_base64] : [], location_name: n.location_name,
                    lat: n.lat, lng: n.lng, time: "", cost: "", rating: 0, notes: "",
                  })) }];
              return days.map((d: any, di: number) => (
                <View key={d.id || di} style={styles.dayBlock}>
                  <View style={styles.dayHead}>
                    <View style={styles.dayPill}><Text style={styles.dayPillText}>DAY {di + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      {d.title ? <Text style={styles.dayTitleText}>{d.title}</Text> : null}
                      {d.date ? <Text style={styles.dayDate}>{d.date}</Text> : null}
                    </View>
                  </View>
                  {d.description ? <Text style={styles.dayDescText}>{d.description}</Text> : null}

                  {(d.entries || []).map((e: any, ei: number) => (
                    <View key={e.id || ei} style={styles.entryWrap}>
                      <View style={styles.timelineCol}>
                        <View style={styles.timelineDot}><Ionicons name={entryIcon(e.kind)} size={11} color="#000" /></View>
                        {ei < (d.entries.length - 1) && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.entryCard}>
                        <View style={styles.entryHeadRow}>
                          <Text style={styles.entryKind}>{(e.kind || "place").toUpperCase()}</Text>
                          {e.time ? <Text style={styles.entryTime}>{e.time}</Text> : null}
                        </View>
                        <Text style={styles.entryName}>{e.title}</Text>
                        {e.location_name ? (
                          <View style={styles.locRow}>
                            <Ionicons name="location-outline" size={12} color={colors.primary} />
                            <Text style={styles.locText} numberOfLines={1}>{e.location_name}</Text>
                          </View>
                        ) : null}
                        {e.description ? <Text style={styles.entryDesc}>{e.description}</Text> : null}
                        {(e.photos && e.photos.length > 0) && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }} contentContainerStyle={{ gap: 8 }}>
                            {e.photos.map((p: string, pi: number) => (
                              <Image key={pi} source={{ uri: p.startsWith("http") ? p : `data:image/jpeg;base64,${p}` }} style={styles.entryPhoto} />
                            ))}
                          </ScrollView>
                        )}
                        <View style={styles.entryMetaRow}>
                          {e.cost ? <View style={styles.metaPill}><Ionicons name="wallet-outline" size={11} color={colors.text} /><Text style={styles.metaText}>{e.cost}</Text></View> : null}
                          {e.rating > 0 ? <View style={styles.metaPill}><Ionicons name="star" size={11} color={colors.primary} /><Text style={styles.metaText}>{e.rating}/5</Text></View> : null}
                        </View>
                        {e.notes ? <Text style={styles.entryNotes}>“{e.notes}”</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ));
            })()}

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

        <Modal visible={actionsOpen} transparent animationType="fade" onRequestClose={() => setActionsOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheetBackdrop} onPress={() => setActionsOpen(false)}>
            <View style={styles.sheet}>
              <View style={styles.sheetGrabber} />
              <Text style={styles.sheetTitle}>Quest options</Text>
              <TouchableOpacity testID="action-edit" style={styles.sheetItem} onPress={onEdit}>
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemTitle}>Edit quest</Text>
                  <Text style={styles.sheetItemDesc}>Update title, days, photos, visibility…</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity testID="action-share" style={styles.sheetItem} onPress={() => { setActionsOpen(false); onShare(); }}>
                <Ionicons name="share-outline" size={20} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemTitle}>Share</Text>
                  <Text style={styles.sheetItemDesc}>Send this quest to anyone</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity testID="action-delete" style={[styles.sheetItem, styles.sheetItemDanger]} onPress={onDelete} disabled={deleting}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetItemTitle, { color: colors.danger }]}>Delete quest</Text>
                  <Text style={styles.sheetItemDesc}>Permanently remove this quest</Text>
                </View>
                {deleting ? <ActivityIndicator color={colors.danger} size="small" /> : <Ionicons name="chevron-forward" size={18} color={colors.danger} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setActionsOpen(false)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function entryIcon(k: string): any {
  switch (k) { case "stay": return "bed";
    case "food": return "restaurant"; case "activity": return "sparkles"; default: return "location"; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hero: { width: "100%", height: 320 },
  iconBtn: {
    position: "absolute", top: 12, left: 12, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  heroActions: {
    position: "absolute", top: 12, right: 12, flexDirection: "row", gap: 8,
  },
  iconBtnRight: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 28,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
  },
  sheetGrabber: {
    width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.4,
    textTransform: "uppercase", marginBottom: spacing.sm, paddingLeft: 4,
  },
  sheetItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.bg, paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  sheetItemDanger: { borderColor: "rgba(255, 75, 75, 0.3)" },
  sheetItemTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  sheetItemDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  sheetCancel: {
    paddingVertical: 14, alignItems: "center", marginTop: 4,
    borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  sheetCancelText: { color: colors.textSecondary, fontWeight: "800" },
  mapPlaceholder: {
    height: 260, borderRadius: radius.lg, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  mapPlaceholderText: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
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
  // Day-wise timeline
  dayBlock: { marginTop: spacing.md },
  dayHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  dayPill: {
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dayPillText: { color: "#000", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  dayTitleText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  dayDate: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  dayDescText: { color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  entryWrap: { flexDirection: "row", marginTop: spacing.md },
  timelineCol: { width: 28, alignItems: "center" },
  timelineDot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 12,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.primarySoft, marginTop: 4 },
  entryCard: {
    flex: 1, backgroundColor: colors.surfaceElevated, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  entryHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryKind: { color: colors.primary, fontWeight: "800", letterSpacing: 1.2, fontSize: 11 },
  entryTime: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  entryName: { color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 4 },
  entryDesc: { color: colors.textSecondary, marginTop: 6 },
  entryPhoto: { width: 200, height: 130, borderRadius: radius.md },
  entryMetaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: spacing.sm },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  metaText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  entryNotes: { color: colors.textSecondary, fontSize: 13, fontStyle: "italic", marginTop: spacing.sm,
    paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.primary },
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
