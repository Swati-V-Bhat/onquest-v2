import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import QuestMap from "../../src/QuestMap";
import { colors, spacing, radius } from "../../src/theme";

const FALLBACK = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1200&auto=format&fit=crop";

type Detail = {
  location_name: string;
  hero: string;
  lat: number | null;
  lng: number | null;
  quest_count: number;
  stop_count: number;
  info: { region: string; best_time: string; vibe: string; about: string; tips: string[] };
  quests: QuestSummary[];
  stops: { title: string; description: string; type: string; photo_base64: string; lat?: number; lng?: number; from_quest: string }[];
};

export default function DestinationPage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/destinations/${encodeURIComponent(String(name || ""))}`);
        setData(data);
      } catch {} finally { setLoading(false); }
    })();
  }, [name]);

  if (loading || !data) {
    return (
      <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
    );
  }

  const hero = data.hero
    ? (data.hero.startsWith("http") ? data.hero : `data:image/jpeg;base64,${data.hero}`)
    : FALLBACK;

  const mapPoints = data.stops
    .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s, i) => ({ lat: s.lat as number, lng: s.lng as number, title: s.title, order: i }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View>
          <Image source={{ uri: hero }} style={styles.hero} />
          <View style={styles.heroOverlay} />
          <TouchableOpacity testID="dest-back" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.heroBottom}>
            <View style={styles.regionPill}>
              <Ionicons name="location" size={11} color={colors.primary} />
              <Text style={styles.regionText}>{data.info.region}</Text>
            </View>
            <Text style={styles.title}>{data.location_name}</Text>
            <Text style={styles.vibe}>{data.info.vibe}</Text>
          </View>
        </View>

        <View style={{ padding: spacing.md }}>
          <View style={styles.statsRow}>
            <Stat label="QUESTS" value={String(data.quest_count)} />
            <Stat label="STOPS" value={String(data.stop_count)} />
            <Stat label="BEST TIME" value={data.info.best_time} small />
          </View>

          <Text style={styles.section}>About</Text>
          <Text style={styles.about}>{data.info.about}</Text>

          {data.info.tips?.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Insider tips</Text>
              {data.info.tips.map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </>
          )}

          {mapPoints.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Stops on the map</Text>
              <View style={{ marginTop: spacing.sm }}>
                <QuestMap points={mapPoints} height={240} />
              </View>
            </>
          )}

          <Text style={[styles.section, { marginTop: spacing.lg }]}>
            {data.quest_count} quest{data.quest_count === 1 ? "" : "s"} from the community
          </Text>
          {data.quests.length === 0 ? (
            <Text style={styles.empty}>No quests yet for this destination.</Text>
          ) : (
            data.quests.map((q) => <QuestCard key={q.id} quest={q} />)
          )}

          <TouchableOpacity
            testID="plan-from-dest"
            style={styles.planBtn}
            onPress={() => router.push({ pathname: "/ai/plan", params: { dest: data.location_name } })}
          >
            <Ionicons name="sparkles" size={18} color="#000" />
            <Text style={styles.planBtnText}>Plan a trip to {data.location_name} with AI</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, small && { fontSize: 13 }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hero: { width: "100%", height: 320 },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 320, backgroundColor: "rgba(0,0,0,0.45)" },
  backBtn: {
    position: "absolute", top: 12, left: 12, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: "rgba(0,0,0,0.55)" },
  regionPill: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  regionText: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  vibe: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontWeight: "700", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  statLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  statValue: { color: colors.primary, fontWeight: "900", fontSize: 18, marginTop: 4, textAlign: "center" },
  section: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.5, marginTop: spacing.lg },
  about: { color: colors.textSecondary, lineHeight: 22, marginTop: spacing.sm },
  tipRow: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  tipText: { color: colors.text, flex: 1 },
  empty: { color: colors.textSecondary, marginTop: spacing.sm },
  planBtn: {
    marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  planBtnText: { color: "#000", fontWeight: "900", letterSpacing: 0.3 },
});
