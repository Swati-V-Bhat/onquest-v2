import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import api from "../../src/api";
import { colors, spacing, radius } from "../../src/theme";

type NodeDraft = {
  id: string;
  title: string;
  description: string;
  type: "place" | "activity";
  photo_base64: string;
  location_name: string;
  lat?: number;
  lng?: number;
};

export default function Create() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverBase64, setCoverBase64] = useState("");
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async (cb: (b64: string) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.6,
    });
    if (!res.canceled && res.assets[0]?.base64) cb(res.assets[0].base64);
  };

  const addNode = (type: "place" | "activity") => {
    setNodes((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, title: "", description: "", type, photo_base64: "", location_name: "" },
    ]);
  };

  const updateNode = (id: string, patch: Partial<NodeDraft>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeNode = (id: string) => setNodes((prev) => prev.filter((n) => n.id !== id));

  const useCurrentLocation = async (id: string) => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Location permission denied.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      updateNode(id, { lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert("Could not fetch location");
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("Add a title");
      return;
    }
    if (nodes.length < 1) {
      Alert.alert("Add at least one stop");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        cover_photo_base64: coverBase64,
        nodes: nodes.map((n, i) => ({
          id: n.id,
          title: n.title.trim() || `Stop ${i + 1}`,
          description: n.description,
          type: n.type,
          photo_base64: n.photo_base64,
          location_name: n.location_name,
          lat: n.lat,
          lng: n.lng,
          order: i,
        })),
      };
      const { data } = await api.post("/quests", payload);
      setTitle(""); setDescription(""); setCoverBase64(""); setNodes([]);
      router.push(`/quest/${data.id}`);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail || "Could not create quest");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.overline}>NEW QUEST</Text>
          <Text style={styles.h1}>Build your journey</Text>
          <Text style={styles.sub}>Chain places & activities into a flowchart story.</Text>

          <TouchableOpacity testID="cover-pick" style={styles.cover} onPress={() => pickImage(setCoverBase64)}>
            {coverBase64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${coverBase64}` }} style={styles.coverImg} />
            ) : (
              <View style={styles.coverEmpty}>
                <Ionicons name="image-outline" size={28} color={colors.primary} />
                <Text style={styles.coverText}>Add a cover photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            testID="quest-title"
            style={styles.input}
            placeholder="Quest title (e.g., Goa Coast Run)"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            testID="quest-desc"
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            placeholder="Short description of your adventure"
            placeholderTextColor={colors.textMuted}
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <Text style={[styles.overline, { marginTop: spacing.lg }]}>FLOWCHART</Text>
          <Text style={styles.sub}>Tap + to add stops in order.</Text>

          {nodes.map((n, idx) => (
            <View key={n.id} style={styles.nodeWrap}>
              {idx > 0 && <View style={styles.connector} />}
              <View style={[styles.nodeCard, n.type === "activity" && styles.nodeCardAlt]}>
                <View style={styles.nodeHeader}>
                  <View style={styles.nodeBadge}>
                    <Text style={styles.nodeBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.nodeType}>{n.type === "place" ? "PLACE" : "ACTIVITY"}</Text>
                  <TouchableOpacity onPress={() => removeNode(n.id)} style={{ marginLeft: "auto" }}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  testID={`node-title-${idx}`}
                  style={styles.input}
                  placeholder={n.type === "place" ? "Where? (e.g., Old Manali)" : "What? (e.g., Paragliding)"}
                  placeholderTextColor={colors.textMuted}
                  value={n.title}
                  onChangeText={(v) => updateNode(n.id, { title: v })}
                />
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                  placeholder="Notes / story"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={n.description}
                  onChangeText={(v) => updateNode(n.id, { description: v })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Location name (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={n.location_name}
                  onChangeText={(v) => updateNode(n.id, { location_name: v })}
                />
                <View style={styles.nodeRow}>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => pickImage((b64) => updateNode(n.id, { photo_base64: b64 }))}>
                    <Ionicons name="image-outline" size={16} color={colors.primary} />
                    <Text style={styles.smallBtnText}>{n.photo_base64 ? "Change photo" : "Add photo"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => useCurrentLocation(n.id)}>
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                    <Text style={styles.smallBtnText}>{n.lat ? `${n.lat.toFixed(2)},${n.lng!.toFixed(2)}` : "Use my GPS"}</Text>
                  </TouchableOpacity>
                </View>
                {n.photo_base64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${n.photo_base64}` }} style={styles.nodeThumb} />
                ) : null}
              </View>
            </View>
          ))}

          <View style={styles.addRow}>
            <TouchableOpacity testID="add-place-btn" style={styles.addBtn} onPress={() => addNode("place")}>
              <Ionicons name="location" size={18} color="#000" />
              <Text style={styles.addBtnText}>Add Place</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="add-activity-btn" style={[styles.addBtn, styles.addBtnAlt]} onPress={() => addNode("activity")}>
              <Ionicons name="sparkles" size={18} color={colors.text} />
              <Text style={[styles.addBtnText, { color: colors.text }]}>Add Activity</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity testID="publish-quest-btn" style={styles.publish} onPress={submit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#000" /> : (
              <>
                <Ionicons name="send" size={18} color="#000" />
                <Text style={styles.publishText}>Publish Quest</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  h1: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  sub: { color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  cover: {
    height: 160, borderRadius: radius.xl, backgroundColor: colors.surface, marginBottom: spacing.md,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  coverImg: { width: "100%", height: "100%" },
  coverEmpty: { alignItems: "center", gap: 6 },
  coverText: { color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  nodeWrap: { marginTop: spacing.md, alignItems: "stretch" },
  connector: { width: 2, height: 22, backgroundColor: colors.primarySoft, alignSelf: "center", marginBottom: 4, borderRadius: 2 },
  nodeCard: {
    backgroundColor: colors.surfaceElevated, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  nodeCardAlt: { borderColor: colors.primarySoft },
  nodeHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, gap: 8 },
  nodeBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  nodeBadgeText: { color: "#000", fontWeight: "900" },
  nodeType: { color: colors.primary, fontWeight: "800", letterSpacing: 1.2, fontSize: 11 },
  nodeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  smallBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  smallBtnText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  nodeThumb: { width: "100%", height: 140, marginTop: spacing.sm, borderRadius: radius.md },
  addRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  addBtn: {
    flex: 1, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  addBtnAlt: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.border },
  addBtnText: { color: "#000", fontWeight: "800" },
  publish: {
    marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: 18, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  publishText: { color: "#000", fontWeight: "900", letterSpacing: 0.5 },
});
