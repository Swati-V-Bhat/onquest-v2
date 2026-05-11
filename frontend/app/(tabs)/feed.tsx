import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { cacheGet, cacheSet } from "../../src/cache";
import { colors, spacing, radius } from "../../src/theme";

const FEED_CACHE_KEY = "feed:v1";
const FEED_TTL = 60; // seconds

export default function Feed() {
  const [quests, setQuests] = useState<QuestSummary[]>(() => cacheGet<QuestSummary[]>(FEED_CACHE_KEY) || []);
  const [loading, setLoading] = useState(() => !cacheGet<QuestSummary[]>(FEED_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<QuestSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Abort any inflight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data } = await api.get("/quests/feed", { signal: ctrl.signal });
      setQuests(data);
      cacheSet(FEED_CACHE_KEY, data, FEED_TTL);
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // Use cache if fresh, otherwise refetch in background
    const cached = cacheGet<QuestSummary[]>(FEED_CACHE_KEY);
    if (cached) { setQuests(cached); setLoading(false); }
    load();
    return () => abortRef.current?.abort();
  }, [load]));

  const runSearch = useCallback(async () => {
    if (!searchText.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(searchText.trim())}`);
      setSearchResults(data || []);
    } catch { setSearchResults([]); } finally { setSearching(false); }
  }, [searchText]);

  const list = searchResults !== null ? searchResults : quests;
  const renderItem = useCallback(({ item }: { item: QuestSummary }) => <QuestCard quest={item} />, []);
  const keyExtractor = useCallback((q: QuestSummary) => q.id, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.overline}>YOUR FEED</Text>
          <Text style={styles.h1}>OnQuest</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="feed-search"
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

      {searchResults !== null && (
        <Text style={styles.searchLabel}>
          {searching ? "Searching…" : `Results for "${searchText}" (${searchResults.length})`}
        </Text>
      )}

      {loading && list.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={48} color={colors.textMuted} />
          <Text style={styles.empty}>{searchResults !== null ? `No quests match "${searchText}"` : "No quests yet. Be the first to share!"}</Text>
        </View>
      ) : (
        <FlatList
          testID="feed-list"
          data={list}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews
          updateCellsBatchingPeriod={50}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  overline: { color: colors.textMuted, letterSpacing: 2, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  h1: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  searchLabel: { color: colors.textSecondary, paddingHorizontal: spacing.md, paddingVertical: 4, fontSize: 12, letterSpacing: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textSecondary, marginTop: spacing.md, textAlign: "center", paddingHorizontal: spacing.lg },
});
