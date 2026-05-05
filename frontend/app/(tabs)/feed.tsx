import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { colors, spacing } from "../../src/theme";

export default function Feed() {
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/quests/feed");
      setQuests(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

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

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : quests.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={48} color={colors.textMuted} />
          <Text style={styles.empty}>No quests yet. Be the first to share!</Text>
        </View>
      ) : (
        <FlatList
          testID="feed-list"
          data={quests}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <QuestCard quest={item} />}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textSecondary, marginTop: spacing.md },
});
