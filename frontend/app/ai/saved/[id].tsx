import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { colors, spacing, radius } from "../../src/theme";

const HERO = "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1200&auto=format&fit=crop";

type Saved = {
  id: string;
  input: any;
  ai_plan: any;
  sponsors: any[];
  matched_quests: QuestSummary[];
  created_at: string;
};

export default function SavedTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [t, setT] = useState<Saved | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/saved-trips/${id}`);
        setT(data);
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const onDelete = async () => {
    try {
      await api.delete(`/saved-trips/${id}`);
      router.back();
    } catch { Alert.alert("Could not delete"); }
  };

  if (loading || !t) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
  }
  const ai = t.ai_plan || {};
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View>
          <Image source={{ uri: HERO }} style={styles.hero} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroHeader}>
            <TouchableOpacity testID="saved-back" style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity testID="saved-delete" style={styles.backBtn} onPress={onDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.overline}>SAVED AI TRIP</Text>
            <Text style={styles.title}>{ai.headline || `Trip to ${t.input?.destination}`}</Text>
            <View style={styles.metaRow}>
              <Pill icon="calendar-outline">{t.input?.duration_days} days</Pill>
              <Pill icon="people-outline">{t.input?.group_type}</Pill>
              <Pill icon="wallet-outline">{t.input?.budget}</Pill>
            </View>
          </View>
        </View>

        <View style={{ padding: spacing.md }}>
          <View style={styles.factsRow}>
            <Fact label="BEST TIME" value={ai.best_time || "—"} />
            <Fact label="EST. COST" value={ai.estimated_cost || "—"} />
          </View>

          {(ai.days || []).length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Itinerary</Text>
              {ai.days.map((d: any) => (
                <View key={d.day} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>D{d.day}</Text></View>
                    <Text style={styles.dayTitle}>{d.title}</Text>
                  </View>
                  {(d.stops || []).map((s: any, i: number) => (
                    <View key={i} style={styles.stopRow}>
                      <Ionicons name={kindIcon(s.kind)} size={14} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stopName}>{s.name}</Text>
                        {s.note ? <Text style={styles.stopNote}>{s.note}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {(ai.tips || []).length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Tips</Text>
              {ai.tips.map((tip: string, i: number) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </>
          )}

          {(t.matched_quests || []).length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Inspiration from community</Text>
              {t.matched_quests.slice(0, 5).map((q) => <QuestCard key={q.id} quest={q} />)}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill({ children, icon }: { children: React.ReactNode; icon: any }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={12} color={colors.text} />
      <Text style={styles.metaText}>{children}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factBox}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function kindIcon(kind: string): any {
  switch (kind) {
    case "food": return "restaurant-outline";
    case "stay": return "bed-outline";
    case "activity": return "sparkles-outline";
    default: return "location-outline";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  hero: { width: "100%", height: 240 },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 240, backgroundColor: "rgba(0,0,0,0.55)" },
  heroHeader: {
    position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: "rgba(0,0,0,0.55)" },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginTop: 6 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  metaText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  factsRow: { flexDirection: "row", gap: 10 },
  factBox: {
    flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  factLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  factValue: { color: colors.text, fontWeight: "800", marginTop: 4, fontSize: 13 },
  section: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  dayCard: {
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm },
  dayBadge: {
    backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  dayBadgeText: { color: "#000", fontWeight: "900", fontSize: 11 },
  dayTitle: { color: colors.text, fontWeight: "800", fontSize: 15, flex: 1 },
  stopRow: { flexDirection: "row", gap: 10, paddingVertical: 6, alignItems: "flex-start" },
  stopName: { color: colors.text, fontWeight: "700" },
  stopNote: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tipRow: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  tipText: { color: colors.text, flex: 1 },
});
