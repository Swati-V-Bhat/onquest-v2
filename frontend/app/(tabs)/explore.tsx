import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import api from "../../src/api";
import QuestCard, { QuestSummary } from "../../src/QuestCard";
import { colors, spacing } from "../../src/theme";

export default function Explore() {
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/quests/explore");
      setQuests(data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.overline}>TRENDING</Text>
        <Text style={styles.h1}>Explore Quests</Text>
        <Text style={styles.sub}>Hidden gems curated by real travelers</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          testID="explore-list"
          data={quests}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <QuestCard quest={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, textTransform: "uppercase", fontWeight: "800" },
  h1: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  sub: { color: colors.textSecondary, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
