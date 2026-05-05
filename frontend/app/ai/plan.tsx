import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, ImageBackground, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { colors, spacing, radius } from "../../src/theme";

const HERO = "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1200&auto=format&fit=crop";

const BUDGETS = ["Low", "Mid", "Premium", "Luxury"];
const TRANSPORTS = ["Flight", "Train", "Road Trip", "Mixed"];
const GROUPS = ["Solo", "Couple", "Family", "Friends", "Workation"];
const VIBES = ["Adventure", "Food", "Calm", "Beach", "Mountains", "Heritage", "Nightlife", "Workation"];
const DURATIONS = [2, 3, 5, 7, 10];

type Plan = {
  input: any;
  matched_quests: QuestSummary[];
  ai_plan: {
    headline: string;
    best_time: string;
    estimated_cost: string;
    days: { day: number; title: string; stops: { name: string; kind: string; note: string }[] }[];
    tips: string[];
  };
  sponsors: { id: string; category: string; title: string; subtitle: string; cta: string; icon: string; image: string }[];
};

export default function AIPlan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dest?: string }>();
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState(params?.dest ? String(params.dest) : "");
  const [duration, setDuration] = useState(3);
  const [budget, setBudget] = useState("Mid");
  const [transport, setTransport] = useState("Mixed");
  const [groupType, setGroupType] = useState("Solo");
  const [vibes, setVibes] = useState<string[]>([]);
  const [customVibe, setCustomVibe] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  const totalSteps = 6;
  const canNext = () => {
    if (step === 0) return destination.trim().length > 1;
    if (step === 1) return duration > 0 && duration <= 60;
    if (step === 5) return vibes.length > 0;
    return true;
  };

  const toggleVibe = (v: string) => {
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/ai/plan-trip", {
        destination: destination.trim(),
        duration_days: duration,
        budget, transport, group_type: groupType, vibes, notes: notes.trim(),
      });
      setPlan(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not generate plan");
    } finally { setLoading(false); }
  };

  const reset = () => {
    setPlan(null); setStep(0);
  };

  if (plan) return <PlanResult plan={plan} onBack={reset} onClose={() => router.back()} />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity testID="ai-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.overline}>AI TRIP PLANNER</Text>
            <Text style={styles.h1}>Plan Your Trip</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Step {step + 1} of {totalSteps}</Text>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <Card>
              <Text style={styles.q}>Where do you want to go?</Text>
              <Text style={styles.sub}>City, region, or country</Text>
              <TextInput
                testID="ai-dest-input"
                style={styles.input}
                placeholder="e.g. Manali, Goa, Bali"
                placeholderTextColor={colors.textMuted}
                value={destination}
                onChangeText={setDestination}
                autoFocus
              />
            </Card>
          )}

          {step === 1 && (
            <Card>
              <Text style={styles.q}>How many days?</Text>
              <Text style={styles.sub}>Pick a typical trip length or enter your own</Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((d) => (
                  <Chip key={d} active={duration === d} onPress={() => setDuration(d)}>{d} days</Chip>
                ))}
              </View>
              <Text style={[styles.sub, { marginTop: spacing.lg }]}>Or enter custom number of days</Text>
              <TextInput
                testID="ai-custom-days"
                style={styles.input}
                placeholder="e.g. 14"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={String(duration)}
                onChangeText={(v) => {
                  const num = parseInt(v.replace(/[^0-9]/g, ""), 10);
                  if (!isNaN(num) && num > 0 && num <= 60) setDuration(num);
                  else if (v === "") setDuration(0);
                }}
              />
              <Text style={styles.helper}>Selected: {duration > 0 ? `${duration} day${duration === 1 ? "" : "s"}` : "—"}</Text>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <Text style={styles.q}>What's your budget?</Text>
              <Text style={styles.sub}>Per person, full trip</Text>
              <View style={styles.chipRow}>
                {BUDGETS.map((b) => (
                  <Chip key={b} active={budget === b} onPress={() => setBudget(b)}>{b}</Chip>
                ))}
              </View>
              <Text style={[styles.sub, { marginTop: spacing.lg }]}>Or describe your own</Text>
              <TextInput
                testID="ai-custom-budget"
                style={styles.input}
                placeholder="e.g. INR 25,000 / Backpacker / All inclusive"
                placeholderTextColor={colors.textMuted}
                value={budget}
                onChangeText={setBudget}
              />
            </Card>
          )}

          {step === 3 && (
            <Card>
              <Text style={styles.q}>Mode of transport?</Text>
              <Text style={styles.sub}>How will you travel</Text>
              <View style={styles.chipRow}>
                {TRANSPORTS.map((t) => (
                  <Chip key={t} active={transport === t} onPress={() => setTransport(t)}>{t}</Chip>
                ))}
              </View>
              <Text style={[styles.sub, { marginTop: spacing.lg }]}>Or describe your own</Text>
              <TextInput
                testID="ai-custom-transport"
                style={styles.input}
                placeholder="e.g. Bullet ride / Private cab / Cycle tour"
                placeholderTextColor={colors.textMuted}
                value={transport}
                onChangeText={setTransport}
              />
            </Card>
          )}

          {step === 4 && (
            <Card>
              <Text style={styles.q}>Travelling as?</Text>
              <Text style={styles.sub}>Pick your travel group</Text>
              <View style={styles.chipRow}>
                {GROUPS.map((g) => (
                  <Chip key={g} active={groupType === g} onPress={() => setGroupType(g)}>{g}</Chip>
                ))}
              </View>
              <Text style={[styles.sub, { marginTop: spacing.lg }]}>Or describe your own</Text>
              <TextInput
                testID="ai-custom-group"
                style={styles.input}
                placeholder="e.g. Group of 6 college friends / Honeymoon"
                placeholderTextColor={colors.textMuted}
                value={groupType}
                onChangeText={setGroupType}
              />
            </Card>
          )}

          {step === 5 && (
            <Card>
              <Text style={styles.q}>Pick your vibes</Text>
              <Text style={styles.sub}>Select all that apply</Text>
              <View style={styles.chipRow}>
                {VIBES.map((v) => (
                  <Chip key={v} active={vibes.includes(v)} onPress={() => toggleVibe(v)}>{v}</Chip>
                ))}
              </View>
              <Text style={[styles.sub, { marginTop: spacing.lg }]}>Add custom vibes</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  testID="ai-custom-vibe"
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g. Photography, Birdwatching"
                  placeholderTextColor={colors.textMuted}
                  value={customVibe}
                  onChangeText={setCustomVibe}
                  onSubmitEditing={() => {
                    const v = customVibe.trim();
                    if (v && !vibes.includes(v)) setVibes([...vibes, v]);
                    setCustomVibe("");
                  }}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  testID="ai-add-vibe-btn"
                  style={styles.addVibeBtn}
                  onPress={() => {
                    const v = customVibe.trim();
                    if (v && !vibes.includes(v)) setVibes([...vibes, v]);
                    setCustomVibe("");
                  }}
                >
                  <Ionicons name="add" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.sub, { marginTop: spacing.lg }]}>Anything else? (optional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                placeholder="e.g. love sunrises, vegetarian food"
                placeholderTextColor={colors.textMuted}
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </Card>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actionsRow}>
            {step > 0 && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(step - 1)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {step < totalSteps - 1 ? (
              <TouchableOpacity
                testID="ai-next-btn"
                style={[styles.primaryBtn, !canNext() && styles.primaryBtnDisabled]}
                disabled={!canNext()}
                onPress={() => setStep(step + 1)}
              >
                <Text style={styles.primaryBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="ai-generate-btn"
                style={[styles.primaryBtn, !canNext() && styles.primaryBtnDisabled]}
                disabled={!canNext() || loading}
                onPress={submit}
              >
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#000" />
                    <Text style={styles.primaryBtnText}>Generate Plan</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Chip({ children, active, onPress }: { children: React.ReactNode; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
}

function PlanResult({ plan, onBack, onClose }: { plan: Plan; onBack: () => void; onClose: () => void }) {
  const router = useRouter();
  const ai = plan.ai_plan;
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <ImageBackground source={{ uri: HERO }} style={styles.resultHero} imageStyle={{ borderRadius: 0 }}>
          <View style={styles.resultHeroOverlay} />
          <View style={styles.resultHeader}>
            <TouchableOpacity testID="result-back" style={styles.backBtnDark} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity testID="result-redo" style={styles.backBtnDark} onPress={onBack}>
              <Ionicons name="refresh" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.resultHeroBottom}>
            <Text style={styles.overline}>YOUR AI TRIP PLAN</Text>
            <Text style={styles.resultTitle}>{ai.headline || `Trip to ${plan.input.destination}`}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}><Ionicons name="calendar-outline" size={12} color={colors.text} /><Text style={styles.metaText}>{plan.input.duration_days} days</Text></View>
              <View style={styles.metaPill}><Ionicons name="people-outline" size={12} color={colors.text} /><Text style={styles.metaText}>{plan.input.group_type}</Text></View>
              <View style={styles.metaPill}><Ionicons name="wallet-outline" size={12} color={colors.text} /><Text style={styles.metaText}>{plan.input.budget}</Text></View>
            </View>
          </View>
        </ImageBackground>

        <View style={{ padding: spacing.md }}>
          <View style={styles.factsRow}>
            <View style={styles.factBox}>
              <Text style={styles.factLabel}>BEST TIME</Text>
              <Text style={styles.factValue}>{ai.best_time}</Text>
            </View>
            <View style={styles.factBox}>
              <Text style={styles.factLabel}>EST. COST</Text>
              <Text style={styles.factValue}>{ai.estimated_cost}</Text>
            </View>
          </View>

          {plan.matched_quests.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>From OnQuest community</Text>
              <Text style={styles.sectionSub}>Real journeys our explorers shared</Text>
              {plan.matched_quests.slice(0, 3).map((q) => <QuestCard key={q.id} quest={q} />)}
            </>
          )}

          {ai.days?.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Your AI itinerary</Text>
              {ai.days.map((d) => (
                <View key={d.day} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>D{d.day}</Text></View>
                    <Text style={styles.dayTitle}>{d.title}</Text>
                  </View>
                  {d.stops?.map((s, i) => (
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

          {ai.tips?.length > 0 && (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>Pro tips</Text>
              {ai.tips.map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </>
          )}

          <Text style={[styles.section, { marginTop: spacing.lg }]}>Travel essentials</Text>
          <Text style={styles.sectionSub}>Sponsored — verified partners for your trip</Text>
          {plan.sponsors.map((s) => (
            <TouchableOpacity key={s.id} activeOpacity={0.85} style={styles.sponsorCard}>
              <Image source={{ uri: s.image }} style={styles.sponsorImg} />
              <View style={styles.sponsorOverlay} />
              <View style={styles.sponsorBody}>
                <View style={styles.sponsorBadge}>
                  <Ionicons name={s.icon as any} size={12} color={colors.primary} />
                  <Text style={styles.sponsorBadgeText}>{s.category}</Text>
                </View>
                <Text style={styles.sponsorTitle}>{s.title}</Text>
                <Text style={styles.sponsorSub}>{s.subtitle}</Text>
                <View style={styles.sponsorCtaPill}><Text style={styles.sponsorCtaText}>{s.cta}</Text><Ionicons name="arrow-forward" size={14} color="#000" /></View>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity testID="save-as-quest-btn" style={[styles.primaryBtn, { marginTop: spacing.xl }]} onPress={() => router.push("/(tabs)/create")}>
            <Ionicons name="add-circle-outline" size={18} color="#000" />
            <Text style={styles.primaryBtnText}>Build this as a Quest</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  h1: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  progressBar: {
    height: 4, backgroundColor: colors.surface, marginHorizontal: spacing.md,
    borderRadius: 2, overflow: "hidden", marginTop: spacing.sm,
  },
  progressFill: { height: "100%", backgroundColor: colors.primary },
  progressText: { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing.md, marginTop: 6, letterSpacing: 1 },
  body: { padding: spacing.md, paddingBottom: 60 },
  card: {
    backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  q: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  sub: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.bg, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "700" },
  chipTextActive: { color: "#000" },
  helper: { color: colors.primary, fontWeight: "700", marginTop: spacing.sm, fontSize: 12, letterSpacing: 0.5 },
  addVibeBtn: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  error: { color: colors.danger, marginVertical: spacing.sm },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  primaryBtn: {
    flex: 1, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: "#000", fontWeight: "900", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: colors.surface, paddingVertical: 16, paddingHorizontal: 18,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  secondaryBtnText: { color: colors.text, fontWeight: "800" },
  resultHero: { height: 240, justifyContent: "space-between" },
  resultHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  resultHeader: {
    flexDirection: "row", justifyContent: "space-between", padding: spacing.md, paddingTop: spacing.lg,
  },
  backBtnDark: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  resultHeroBottom: { padding: spacing.md },
  resultTitle: { color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginTop: 4 },
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
  sectionSub: { color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  dayCard: {
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm },
  dayBadge: {
    backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dayBadgeText: { color: "#000", fontWeight: "900", fontSize: 11 },
  dayTitle: { color: colors.text, fontWeight: "800", fontSize: 15, flex: 1 },
  stopRow: { flexDirection: "row", gap: 10, paddingVertical: 6, alignItems: "flex-start" },
  stopName: { color: colors.text, fontWeight: "700" },
  stopNote: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tipRow: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  tipText: { color: colors.text, flex: 1, lineHeight: 20 },
  sponsorCard: {
    height: 160, marginBottom: spacing.sm, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  sponsorImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  sponsorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sponsorBody: { flex: 1, padding: spacing.md, justifyContent: "flex-end" },
  sponsorBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  sponsorBadgeText: { color: colors.primary, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  sponsorTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 8 },
  sponsorSub: { color: "rgba(255,255,255,0.85)", marginTop: 2, fontSize: 12 },
  sponsorCtaPill: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, marginTop: 10,
  },
  sponsorCtaText: { color: "#000", fontWeight: "800" },
});
