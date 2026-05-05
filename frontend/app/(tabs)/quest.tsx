import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground,
  ActivityIndicator, FlatList, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { colors, spacing, radius } from "../../src/theme";

const HERO_BG = "https://images.unsplash.com/photo-1739369984570-aff23bb45d9a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHx0cmF2ZWxlciUyMG1vdW50YWluJTIwYWR2ZW50dXJlJTIwc3Vuc2V0fGVufDB8fHx8MTc3Nzk5NDQyN3ww&ixlib=rb-4.1.0&q=85";
const FALLBACK_DEST = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop";

type Destination = {
  location_name: string;
  quest_count: number;
  sample_photo?: string;
  sample_cover?: string;
};

export default function QuestTab() {
  const router = useRouter();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [myQuests, setMyQuests] = useState<QuestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMine, setShowMine] = useState(false);

  const load = useCallback(async () => {
    try {
      const [destRes, mineRes] = await Promise.all([
        api.get("/popular-destinations"),
        api.get("/users/me/quests"),
      ]);
      setDestinations(destRes.data || []);
      setMyQuests(mineRes.data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (showMine) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.mineHeader}>
          <TouchableOpacity testID="back-from-mine" onPress={() => setShowMine(false)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.overline}>YOUR JOURNEYS</Text>
            <Text style={styles.h1}>My Quests</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <FlatList
          testID="my-quests-list"
          data={myQuests}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <QuestCard quest={item} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="map-outline" size={48} color={colors.textMuted} />
              <Text style={styles.empty}>No quests yet. Tap Post to start.</Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoDot}><Ionicons name="compass" size={16} color="#000" /></View>
            <Text style={styles.brandText}>OnQuest</Text>
          </View>
          <View style={styles.iconRow}>
            <View style={styles.iconBtn}><Ionicons name="chatbubble-outline" size={18} color={colors.text} /></View>
            <View style={styles.iconBtn}><Ionicons name="notifications-outline" size={18} color={colors.text} /></View>
          </View>
        </View>

        <ImageBackground source={{ uri: HERO_BG }} style={styles.hero} imageStyle={styles.heroImg}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Share Your Latest Trip</Text>
            <Text style={styles.heroSub}>
              Inspire fellow travellers by posting your journey — from photos and moments to tips and memories, all deserving to be seen.
            </Text>

            <TouchableOpacity testID="quest-create-btn" style={styles.primaryBtn} onPress={() => router.push("/(tabs)/create")}>
              <Ionicons name="add" size={22} color="#000" />
              <Text style={styles.primaryBtnText}>Create Quest</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="quest-mine-btn" style={styles.secondaryBtn} onPress={() => setShowMine(true)}>
              <Ionicons name="folder-open-outline" size={20} color={colors.text} />
              <Text style={styles.secondaryBtnText}>My Quests {myQuests.length > 0 ? `(${myQuests.length})` : ""}</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
          <Text style={styles.sectionTitle}>Popular Destinations</Text>
          <Text style={styles.sectionSub}>Trending spots from the OnQuest community</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : destinations.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="location-outline" size={36} color={colors.textMuted} />
            <Text style={styles.empty}>No destinations yet. Add a stop to your quest.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md }}
          >
            {destinations.map((d, idx) => (
              <DestinationCard key={`${d.location_name}-${idx}`} dest={d} />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DestinationCard({ dest }: { dest: Destination }) {
  const photo = dest.sample_photo
    ? `data:image/jpeg;base64,${dest.sample_photo}`
    : dest.sample_cover
    ? `data:image/jpeg;base64,${dest.sample_cover}`
    : FALLBACK_DEST;
  return (
    <View style={styles.destCard}>
      <Image source={{ uri: photo }} style={styles.destImg} />
      <View style={styles.destOverlay} />
      <View style={styles.destText}>
        <Text style={styles.destName} numberOfLines={3}>{dest.location_name}</Text>
        <Text style={styles.destCount}>{dest.quest_count} quest{dest.quest_count === 1 ? "" : "s"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  brandText: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  iconRow: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  hero: {
    height: 380, marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.xl, overflow: "hidden",
  },
  heroImg: { borderRadius: radius.xl },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heroContent: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  heroTitle: {
    color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5,
  },
  heroSub: {
    color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: spacing.sm,
    fontSize: 13, lineHeight: 19,
  },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 24,
    borderRadius: radius.pill, marginTop: spacing.lg, alignSelf: "stretch",
    shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { color: "#000", fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: radius.pill, marginTop: spacing.sm, alignSelf: "stretch",
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  sectionSub: { color: colors.textSecondary, marginTop: 2 },
  destCard: {
    width: 240, height: 220, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  destImg: { width: "100%", height: "100%", position: "absolute" },
  destOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  destText: {
    position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  destName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  destCount: { color: colors.primary, fontWeight: "700", fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.textSecondary, marginTop: spacing.md, textAlign: "center" },
  mineHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  h1: { color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
});
