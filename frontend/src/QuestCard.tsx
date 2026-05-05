import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "./theme";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1739369984570-aff23bb45d9a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHx0cmF2ZWxlciUyMG1vdW50YWluJTIwYWR2ZW50dXJlJTIwc3Vuc2V0fGVufDB8fHx8MTc3Nzk5NDQyN3ww&ixlib=rb-4.1.0&q=85";

export type QuestSummary = {
  id: string;
  title: string;
  description?: string;
  cover_photo_base64?: string;
  author: { id: string; name: string; avatar?: string };
  likes_count: number;
  comments_count: number;
  nodes: { title: string; lat?: number; lng?: number }[];
  created_at: string;
};

export default function QuestCard({ quest }: { quest: QuestSummary }) {
  const router = useRouter();
  const cover = quest.cover_photo_base64
    ? `data:image/jpeg;base64,${quest.cover_photo_base64}`
    : FALLBACK_IMG;
  const stops = quest.nodes?.length || 0;

  return (
    <TouchableOpacity
      testID={`quest-card-${quest.id}`}
      activeOpacity={0.85}
      onPress={() => router.push(`/quest/${quest.id}`)}
      style={styles.card}
    >
      <ImageBackground source={{ uri: cover }} style={styles.image} imageStyle={{ borderRadius: radius.xl }}>
        <View style={styles.gradientOverlay} />
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Ionicons name="git-network-outline" size={12} color={colors.primary} />
            <Text style={styles.badgeText}>{stops} STOPS</Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={2}>{quest.title}</Text>
          {quest.description ? (
            <Text style={styles.desc} numberOfLines={2}>{quest.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.author}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(quest.author?.name || "?").charAt(0).toUpperCase()}</Text></View>
              <Text style={styles.authorName} numberOfLines={1}>{quest.author?.name || "Explorer"}</Text>
            </View>
            <View style={styles.actions}>
              <View style={styles.actionPill}>
                <Ionicons name="heart" size={14} color={colors.primary} />
                <Text style={styles.actionText}>{quest.likes_count}</Text>
              </View>
              <View style={styles.actionPill}>
                <Ionicons name="chatbubble-outline" size={13} color={colors.text} />
                <Text style={styles.actionText}>{quest.comments_count}</Text>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  image: { height: 380, justifyContent: "space-between", padding: spacing.md },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: radius.xl,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  badgeText: { color: colors.primary, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  bottom: { padding: spacing.md, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radius.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  desc: { color: "rgba(255,255,255,0.85)", marginTop: 6, fontSize: 13 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  author: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginRight: 8,
  },
  avatarText: { color: "#000", fontWeight: "900" },
  authorName: { color: colors.text, fontWeight: "600", flex: 1 },
  actions: { flexDirection: "row", gap: 8 },
  actionPill: {
    backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  actionText: { color: colors.text, fontSize: 12, fontWeight: "700" },
});
