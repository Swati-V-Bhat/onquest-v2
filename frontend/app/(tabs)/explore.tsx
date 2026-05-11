import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground,
  TextInput, Image, ActivityIndicator, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { cacheGet, cacheSet } from "../../src/cache";
import { colors, spacing, radius } from "../../src/theme";

const BRAND_LOGO = require("../../assets/images/quest-icon.png");

const HERO = "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1200&auto=format&fit=crop";
const FALLBACK = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop";

type LeaderRow = {
  rank: number;
  user: { id: string; name: string; avatar?: string };
  qp: number;
  rank_label: string;
};

type Destination = {
  location_name: string;
  quest_count: number;
  sample_photo?: string;
  sample_cover?: string;
};

export default function Explore() {
  const router = useRouter();
  const [trending, setTrending] = useState<QuestSummary[]>(() => cacheGet<QuestSummary[]>("explore:trending") || []);
  const [recommended, setRecommended] = useState<QuestSummary[]>(() => cacheGet<QuestSummary[]>("explore:rec") || []);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>(() => cacheGet<LeaderRow[]>("explore:lb") || []);
  const [destinations, setDestinations] = useState<Destination[]>(() => cacheGet<Destination[]>("explore:dest") || []);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<QuestSummary[] | null>(null);
  const [loading, setLoading] = useState(() => !cacheGet("explore:trending"));
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const [t, r, l, d] = await Promise.all([
        api.get("/quests/explore", { signal: ctrl.signal }),
        api.get("/recommendations", { signal: ctrl.signal }),
        api.get("/leaderboard", { signal: ctrl.signal }),
        api.get("/popular-destinations", { signal: ctrl.signal }),
      ]);
      setTrending(t.data || []); cacheSet("explore:trending", t.data || [], 60);
      setRecommended(r.data || []); cacheSet("explore:rec", r.data || [], 60);
      setLeaderboard(l.data || []); cacheSet("explore:lb", l.data || [], 60);
      setDestinations(d.data || []); cacheSet("explore:dest", d.data || [], 300);
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);
  useFocusEffect(useCallback(() => { load(); return () => abortRef.current?.abort(); }, [load]));

  const runSearch = async () => {
    if (!searchText.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(searchText.trim())}`);
      setSearchResults(data || []);
    } catch { setSearchResults([]); } finally { setSearching(false); }
  };

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 5);
  // Order: 2nd, 1st, 3rd for podium look
  const podiumOrdered = [podium[1], podium[0], podium[2]].filter(Boolean);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Image source={BRAND_LOGO} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.brandText}>OnQuest</Text>
          </View>
          <View style={styles.iconRow}>
            <View style={styles.iconBtn}><Ionicons name="chatbubble-outline" size={18} color={colors.text} /></View>
            <View style={styles.iconBtn}><Ionicons name="notifications-outline" size={18} color={colors.text} /></View>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="explore-search"
            style={styles.searchInput}
            placeholder="Search quests, locations, or travelers..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(""); setSearchResults(null); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {searchResults !== null ? (
          <View style={{ padding: spacing.md }}>
            <Text style={styles.sectionTitle}>Search results</Text>
            {searching ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.empty}>No quests match "{searchText}"</Text>
            ) : (
              searchResults.map((q) => <QuestCard key={q.id} quest={q} />)
            )}
          </View>
        ) : (
          <>
            <ImageBackground source={{ uri: HERO }} style={styles.hero} imageStyle={styles.heroImg}>
              <View style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={11} color={colors.primary} />
                  <Text style={styles.aiBadgeText}>RECOMMENDATION ENGINE</Text>
                </View>
                <Text style={styles.aiHeroText}>
                  Plan your trip using journeys from real travelers — curated by our custom recommendation engine.
                </Text>
                <TouchableOpacity
                  testID="ai-plan-cta"
                  style={styles.aiCta}
                  onPress={() => router.push("/ai/plan")}
                  activeOpacity={0.9}
                >
                  <View style={styles.aiCtaIcon}><Ionicons name="bulb" size={18} color="#000" /></View>
                  <Text style={styles.aiCtaText}>Plan Your Trip with AI</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </ImageBackground>

            <SectionHeader title="Trending Quests" sub="What other travelers are up to this week" />
            {loading ? <Loading /> : (
              <HorizontalRail
                data={trending}
                renderItem={(q) => <MiniQuest quest={q} onPress={() => router.push(`/quest/${q.id}`)} />}
                emptyText="No trending quests yet"
              />
            )}

            <SectionHeader title="Recommended for You" sub="Handpicked just for you" />
            {loading ? <Loading /> : (
              <HorizontalRail
                data={recommended}
                renderItem={(q) => <MiniQuest quest={q} onPress={() => router.push(`/quest/${q.id}`)} />}
                emptyText="Add a quest to get recommendations"
              />
            )}

            <View style={styles.leadHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="trophy" size={20} color={colors.primary} />
                <View>
                  <Text style={styles.sectionTitle}>Top Questers</Text>
                  <Text style={styles.sectionSub}>Quest Points leaderboard</Text>
                </View>
              </View>
              <TouchableOpacity><Text style={styles.viewAll}>View All ›</Text></TouchableOpacity>
            </View>

            {leaderboard.length === 0 ? (
              <View style={{ padding: spacing.md }}><Text style={styles.empty}>No questers yet.</Text></View>
            ) : (
              <View style={styles.leadCard}>
                <View style={styles.podiumRow}>
                  {podiumOrdered.map((p, i) => {
                    const realRank = p?.rank;
                    const big = realRank === 1;
                    return (
                      <View key={p.user.id} style={[styles.podiumItem, big && styles.podiumItemBig]}>
                        {big && <Text style={styles.crown}>👑</Text>}
                        <View style={[styles.podiumAvatar, big && styles.podiumAvatarBig, realRank === 1 && { borderColor: colors.primary }, realRank === 2 && { borderColor: "#C0C0C0" }, realRank === 3 && { borderColor: "#CD7F32" }]}>
                          <Text style={styles.podiumAvatarText}>{p.user.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.medal}><Text style={styles.medalNum}>{realRank}</Text></View>
                        <Text style={styles.podiumName} numberOfLines={1}>{p.user.name}</Text>
                        <Text style={styles.podiumQp}>{p.qp} QP</Text>
                      </View>
                    );
                  })}
                </View>
                {rest.length > 0 && <View style={styles.divider} />}
                {rest.map((p) => (
                  <View key={p.user.id} style={styles.leadRow}>
                    <Text style={styles.leadRank}>{p.rank}</Text>
                    <View style={styles.leadAvatar}><Text style={styles.leadAvatarText}>{p.user.name.charAt(0).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leadName}>{p.user.name}</Text>
                      <Text style={styles.leadLabel}>{p.rank_label}</Text>
                    </View>
                    <Text style={styles.leadQp}>{p.qp} QP</Text>
                  </View>
                ))}
              </View>
            )}

            <SectionHeader title="Popular Destinations" sub="Trending spots from the OnQuest community" />
            {loading ? <Loading /> : (
              <HorizontalRail
                data={destinations}
                renderItem={(d) => <DestinationCard dest={d} />}
                emptyText="No destinations yet"
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

function Loading() {
  return <View style={{ padding: spacing.lg, alignItems: "flex-start" }}><ActivityIndicator color={colors.primary} /></View>;
}

function HorizontalRail<T>({ data, renderItem, emptyText }: { data: T[]; renderItem: (item: T) => React.ReactNode; emptyText: string }) {
  if (!data || data.length === 0) {
    return <View style={{ paddingHorizontal: spacing.md }}><Text style={styles.empty}>{emptyText}</Text></View>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      {data.map((item, idx) => <View key={idx}>{renderItem(item)}</View>)}
    </ScrollView>
  );
}

function MiniQuest({ quest, onPress }: { quest: QuestSummary; onPress: () => void }) {
  const cover = quest.cover_photo_base64
    ? (quest.cover_photo_base64.startsWith("http") ? quest.cover_photo_base64 : `data:image/jpeg;base64,${quest.cover_photo_base64}`)
    : FALLBACK;
  return (
    <TouchableOpacity testID={`mini-quest-${quest.id}`} activeOpacity={0.85} onPress={onPress} style={styles.mini}>
      <ImageBackground source={{ uri: cover }} style={styles.miniImg} imageStyle={{ borderRadius: radius.lg }}>
        <View style={styles.miniOverlay} />
        <View style={styles.miniAuthor}>
          <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{(quest.author?.name || "?").charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.miniAuthorName} numberOfLines={1}>{quest.author?.name || "Explorer"}</Text>
        </View>
      </ImageBackground>
      <Text style={styles.miniTitle} numberOfLines={1}>{quest.title}</Text>
      <Text style={styles.miniMeta} numberOfLines={2}>
        {quest.nodes?.length || 0} stops · {quest.likes_count || 0} likes
      </Text>
    </TouchableOpacity>
  );
}

function DestinationCard({ dest }: { dest: Destination }) {
  const router = useRouter();
  const photo = dest.sample_photo
    ? (dest.sample_photo.startsWith("http") ? dest.sample_photo : `data:image/jpeg;base64,${dest.sample_photo}`)
    : dest.sample_cover
    ? (dest.sample_cover.startsWith("http") ? dest.sample_cover : `data:image/jpeg;base64,${dest.sample_cover}`)
    : FALLBACK;
  return (
    <TouchableOpacity
      testID={`explore-dest-${dest.location_name}`}
      activeOpacity={0.85}
      onPress={() => router.push(`/destination/${encodeURIComponent(dest.location_name)}`)}
      style={styles.destCard}
    >
      <Image source={{ uri: photo }} style={styles.destImg} />
      <View style={styles.destOverlay} />
      <View style={styles.destText}>
        <Text style={styles.destName} numberOfLines={3}>{dest.location_name}</Text>
        <Text style={styles.destCount}>{dest.quest_count} quest{dest.quest_count === 1 ? "" : "s"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 28, height: 28, tintColor: colors.primary },
  logoDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  brandText: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  iconRow: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  hero: {
    height: 300, marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: radius.xl, overflow: "hidden", justifyContent: "flex-end",
  },
  heroImg: { borderRadius: radius.xl },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  heroContent: { padding: spacing.md, justifyContent: "flex-end" },
  aiBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  aiBadgeText: { color: colors.primary, fontWeight: "800", fontSize: 10, letterSpacing: 1.4 },
  aiHeroText: {
    color: colors.text, fontSize: 17, fontWeight: "800", letterSpacing: -0.3,
    marginTop: spacing.sm, lineHeight: 23,
  },
  aiCta: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff",
    marginTop: spacing.md, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  aiCtaIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  aiCtaText: { color: "#000", fontWeight: "800", flex: 1, fontSize: 15 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  sectionSub: { color: colors.textSecondary, marginTop: 2 },
  empty: { color: colors.textSecondary, padding: spacing.md },
  mini: { width: 220 },
  miniImg: { width: 220, height: 140, justifyContent: "flex-end" },
  miniOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: radius.lg },
  miniAuthor: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)", margin: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.pill, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border,
  },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { color: "#000", fontWeight: "900", fontSize: 11 },
  miniAuthorName: { color: colors.text, fontWeight: "700", fontSize: 12, maxWidth: 130 },
  miniTitle: { color: colors.text, fontWeight: "800", marginTop: 8, fontSize: 14 },
  miniMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  leadHeaderRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  viewAll: { color: colors.primary, fontWeight: "800" },
  leadCard: {
    marginHorizontal: spacing.md, padding: spacing.md, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  podiumRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
  podiumItem: { alignItems: "center", flex: 1 },
  podiumItemBig: { transform: [{ translateY: -8 }] },
  crown: { fontSize: 18, marginBottom: 2 },
  podiumAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border,
  },
  podiumAvatarBig: { width: 70, height: 70, borderRadius: 35 },
  podiumAvatarText: { color: colors.text, fontWeight: "900", fontSize: 22 },
  medal: {
    backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999, marginTop: -8, borderWidth: 2, borderColor: colors.surface,
  },
  medalNum: { color: "#000", fontWeight: "900", fontSize: 11 },
  podiumName: { color: colors.text, fontWeight: "800", marginTop: 6, fontSize: 12, maxWidth: 100, textAlign: "center" },
  podiumQp: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  leadRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  leadRank: { color: colors.textSecondary, fontWeight: "800", width: 18 },
  leadAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  leadAvatarText: { color: "#000", fontWeight: "900" },
  leadName: { color: colors.text, fontWeight: "800" },
  leadLabel: { color: colors.textMuted, fontSize: 12 },
  leadQp: { color: colors.primary, fontWeight: "900" },
  destCard: {
    width: 240, height: 180, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  destImg: { width: "100%", height: "100%", position: "absolute" },
  destOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  destText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: "rgba(0,0,0,0.55)" },
  destName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  destCount: { color: colors.primary, fontWeight: "700", fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
});
