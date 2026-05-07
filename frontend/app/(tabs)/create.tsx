import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import api from "../../src/api";
import { pickAndCompress } from "../../src/imagePick";
import { colors, spacing, radius } from "../../src/theme";

const PRESET_TAGS = [
  "Adventurous", "Spiritual", "Picturesque",
  "Foodie", "Heritage", "Road Trip",
];

const VISIBILITY_OPTIONS = [
  { id: "public", title: "Public", desc: "Anyone on OnQuest can see this", icon: "earth-outline" as const },
  { id: "friends", title: "Friends", desc: "Only your followers can see this", icon: "people-outline" as const },
  { id: "private", title: "Private", desc: "Only you can see this", icon: "lock-closed-outline" as const },
];

const ENTRY_KINDS = [
  { id: "place",    label: "Place",    icon: "location-outline" as const },
  { id: "activity", label: "Activity", icon: "sparkles-outline" as const },
  { id: "stay",     label: "Stay",     icon: "bed-outline" as const },
  { id: "food",     label: "Food",     icon: "restaurant-outline" as const },
];

type Entry = {
  id: string;
  kind: "place" | "activity" | "stay" | "food";
  title: string;
  description: string;
  photos: string[];
  location_name: string;
  lat?: number;
  lng?: number;
  time: string;
  cost: string;
  rating: number;
  notes: string;
};

type Day = {
  id: string;
  title: string;
  description: string;
  date: string;
  entries: Entry[];
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function Create() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);

  // Step 1 — quest meta
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverBase64, setCoverBase64] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [tripDays, setTripDays] = useState(3);
  const [visibility, setVisibility] = useState<"public" | "private" | "friends">("public");

  // Step 2 — days (auto-created from tripDays)
  const [days, setDays] = useState<Day[]>([]);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // Initialize days from tripDays when entering step 2
  useEffect(() => {
    if (step === 1 && days.length === 0) {
      const initial = Array.from({ length: Math.max(1, tripDays) }, () => ({
        id: newId(), title: "", description: "", date: "", entries: [],
      }));
      setDays(initial);
      setOpenDays(Object.fromEntries(initial.map((d, i) => [d.id, i === 0])));
    }
  }, [step, tripDays, days.length]);

  // Entry editor modal
  const [entryEditor, setEntryEditor] = useState<{ dayId: string; entry: Entry } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const pickCover = async () => {
    const arr = await pickAndCompress({ multi: false, maxWidth: 1200, quality: 0.6 });
    if (arr.length > 0) setCoverBase64(arr[0]);
  };

  const toggleTag = (t: string) => {
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  };

  const addCustomTags = () => {
    const items = customTagInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    setTags((p) => Array.from(new Set([...p, ...items])));
    setCustomTagInput("");
  };

  const removeTag = (t: string) => setTags((p) => p.filter((x) => x !== t));

  const addDay = () => {
    const d: Day = { id: newId(), title: "", description: "", date: "", entries: [] };
    setDays((p) => [...p, d]);
    setOpenDays((o) => ({ ...o, [d.id]: true }));
  };

  const updateDay = (id: string, patch: Partial<Day>) => {
    setDays((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDay = (id: string) => {
    if (days.length === 1) {
      Alert.alert("At least one day is required");
      return;
    }
    setDays((p) => p.filter((d) => d.id !== id));
  };

  const startNewEntry = (dayId: string, kind: Entry["kind"]) => {
    setEntryEditor({
      dayId,
      entry: {
        id: newId(), kind, title: "", description: "",
        photos: [], location_name: "", time: "", cost: "", rating: 0, notes: "",
      },
    });
  };

  const startEditEntry = (dayId: string, entry: Entry) => {
    setEntryEditor({ dayId, entry: { ...entry } });
  };

  const saveEntry = (dayId: string, entry: Entry) => {
    setDays((p) =>
      p.map((d) => {
        if (d.id !== dayId) return d;
        const exists = d.entries.find((e) => e.id === entry.id);
        const entries = exists
          ? d.entries.map((e) => (e.id === entry.id ? entry : e))
          : [...d.entries, entry];
        return { ...d, entries };
      })
    );
    setEntryEditor(null);
  };

  const removeEntry = (dayId: string, entryId: string) => {
    setDays((p) =>
      p.map((d) => (d.id === dayId ? { ...d, entries: d.entries.filter((e) => e.id !== entryId) } : d))
    );
  };

  const submit = async () => {
    if (!title.trim()) { Alert.alert("Add a quest title"); return; }
    const totalEntries = days.reduce((a, d) => a + d.entries.length, 0);
    if (totalEntries === 0) { Alert.alert("Add at least one entry to a day"); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        cover_photo_base64: coverBase64,
        tags, visibility,
        days: days.map((d, di) => ({
          id: d.id, title: d.title.trim(), description: d.description.trim(), date: d.date.trim(), order: di,
          entries: d.entries.map((e, ei) => ({
            id: e.id, kind: e.kind, title: e.title.trim() || `${e.kind.charAt(0).toUpperCase() + e.kind.slice(1)} ${ei + 1}`,
            description: e.description, photos: e.photos, location_name: e.location_name,
            lat: e.lat, lng: e.lng, time: e.time, cost: e.cost, rating: e.rating, notes: e.notes,
            order: ei,
          })),
        })),
      };
      const { data } = await api.post("/quests", payload);
      // Reset
      setTitle(""); setDescription(""); setCoverBase64(""); setTags([]); setVisibility("public");
      setDays([{ id: newId(), title: "", description: "", date: "", entries: [] }]);
      setStep(0);
      router.push(`/quest/${data.id}`);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail || "Could not publish");
    } finally { setSubmitting(false); }
  };

  const totalEntries = days.reduce((a, d) => a + d.entries.length, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.overline}>NEW QUEST</Text>
            <Text style={styles.h1}>{step === 0 ? "Tell us about your trip" : "Build your timeline"}</Text>
          </View>
          <View style={styles.stepDots}>
            <View style={[styles.dot, step === 0 && styles.dotActive]} />
            <View style={[styles.dot, step === 1 && styles.dotActive]} />
          </View>
        </View>

        {step === 0 ? (
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <TouchableOpacity testID="cover-pick" style={styles.cover} onPress={pickCover}>
              {coverBase64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${coverBase64}` }} style={StyleSheet.absoluteFill as any} />
              ) : (
                <View style={styles.coverEmpty}>
                  <Ionicons name="image-outline" size={32} color={colors.primary} />
                  <Text style={styles.coverText}>Add a cover photo</Text>
                  <Text style={styles.coverSub}>The first image people see</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Quest title</Text>
            <TextInput testID="quest-title" style={styles.input} placeholder="e.g. Manali to Spiti Cold Desert Loop"
              placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Description</Text>
            <TextInput testID="quest-desc" style={[styles.input, { height: 90, textAlignVertical: "top" }]}
              placeholder="A short story about your adventure" placeholderTextColor={colors.textMuted}
              multiline value={description} onChangeText={setDescription} />

            <Text style={styles.label}>Tags</Text>
            <Text style={styles.helpText}>Pick the obvious ones</Text>
            <View style={styles.chipRow}>
              {PRESET_TAGS.map((t) => (
                <TouchableOpacity key={t} onPress={() => toggleTag(t)}
                  style={[styles.chip, tags.includes(t) && styles.chipActive]}>
                  <Text style={[styles.chipText, tags.includes(t) && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.helpText, { marginTop: spacing.md }]}>Or add your own (comma-separated)</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                testID="custom-tag-input"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="e.g. Bullet ride, Vegan food, Stargazing"
                placeholderTextColor={colors.textMuted}
                value={customTagInput}
                onChangeText={setCustomTagInput}
                onSubmitEditing={addCustomTags}
                returnKeyType="done"
              />
              <TouchableOpacity testID="add-tag-btn" style={styles.addTagBtn} onPress={addCustomTags}>
                <Ionicons name="add" size={20} color="#000" />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
                {tags.map((t) => (
                  <View key={t} style={[styles.chip, styles.chipActive, { paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                    <Text style={[styles.chipText, styles.chipTextActive]}>{t}</Text>
                    <TouchableOpacity onPress={() => removeTag(t)}>
                      <Ionicons name="close" size={14} color="#000" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.label}>Trip length</Text>
            <Text style={styles.helpText}>Days will be auto-created in step 2</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 5, 7, 10].map((d) => (
                <TouchableOpacity key={d} onPress={() => { setTripDays(d); setDays([]); }}
                  style={[styles.chip, tripDays === d && styles.chipActive]}>
                  <Text style={[styles.chipText, tripDays === d && styles.chipTextActive]}>{d} day{d === 1 ? "" : "s"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="custom-days-input"
              style={[styles.input, { marginTop: spacing.sm }]}
              placeholder="Or enter custom (1–60)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={String(tripDays || "")}
              onChangeText={(v) => {
                const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                if (!isNaN(n) && n > 0 && n <= 60) { setTripDays(n); setDays([]); }
                else if (v === "") setTripDays(0);
              }}
            />

            <Text style={styles.label}>Visibility</Text>
            {VISIBILITY_OPTIONS.map((v) => (
              <TouchableOpacity key={v.id} onPress={() => setVisibility(v.id as any)}
                style={[styles.visRow, visibility === v.id && styles.visRowActive]}>
                <Ionicons name={v.icon} size={20} color={visibility === v.id ? colors.primary : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.visTitle}>{v.title}</Text>
                  <Text style={styles.visDesc}>{v.desc}</Text>
                </View>
                <View style={[styles.radio, visibility === v.id && styles.radioActive]}>
                  {visibility === v.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity testID="next-step-btn" disabled={!title.trim() || tripDays < 1}
              style={[styles.primaryBtn, (!title.trim() || tripDays < 1) && { opacity: 0.4 }]}
              onPress={() => setStep(1)}>
              <Text style={styles.primaryBtnText}>Next: Build {tripDays}-day timeline</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
              <View style={styles.timelineHeader}>
                <Text style={styles.summary}>{title}</Text>
                <Text style={styles.summarySub}>{days.length} day{days.length === 1 ? "" : "s"} · {totalEntries} entr{totalEntries === 1 ? "y" : "ies"}</Text>
              </View>

              {days.map((day, idx) => (
                <DayCard key={day.id}
                  day={day} index={idx} expanded={openDays[day.id] !== false}
                  onToggle={() => setOpenDays((o) => ({ ...o, [day.id]: o[day.id] === false }))}
                  onUpdate={(p) => updateDay(day.id, p)}
                  onRemove={() => removeDay(day.id)}
                  onAddEntry={(kind) => startNewEntry(day.id, kind)}
                  onEditEntry={(e) => startEditEntry(day.id, e)}
                  onRemoveEntry={(eid) => removeEntry(day.id, eid)}
                />
              ))}

              <TouchableOpacity testID="add-day-btn" style={styles.addDayBtn} onPress={addDay}>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
                <Text style={styles.addDayText}>Add another day</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="publish-quest-btn" style={[styles.publishBtn, submitting && { opacity: 0.6 }]}
                onPress={submit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="send" size={18} color="#000" />
                    <Text style={styles.publishText}>Publish Quest</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal visible={!!entryEditor} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => setEntryEditor(null)}>
          {entryEditor && (
            <EntryEditor
              entry={entryEditor.entry}
              onClose={() => setEntryEditor(null)}
              onSave={(e) => saveEntry(entryEditor.dayId, e)}
            />
          )}
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DayCard(props: {
  day: Day; index: number; expanded: boolean;
  onToggle: () => void;
  onUpdate: (p: Partial<Day>) => void;
  onRemove: () => void;
  onAddEntry: (k: Entry["kind"]) => void;
  onEditEntry: (e: Entry) => void;
  onRemoveEntry: (id: string) => void;
}) {
  const { day, index, expanded, onToggle, onUpdate, onRemove, onAddEntry, onEditEntry, onRemoveEntry } = props;
  return (
    <View style={styles.dayCard}>
      <TouchableOpacity style={styles.dayHeader} onPress={onToggle} activeOpacity={0.85}>
        <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>D{index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayLabel}>Day {index + 1}{day.title ? ` · ${day.title}` : ""}</Text>
          <Text style={styles.dayMeta}>{day.entries.length} entr{day.entries.length === 1 ? "y" : "ies"}{day.date ? ` · ${day.date}` : ""}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <TextInput style={styles.input} placeholder="Day title (optional)" placeholderTextColor={colors.textMuted}
            value={day.title} onChangeText={(v) => onUpdate({ title: v })} />
          <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]}
            placeholder="Day description (optional)" placeholderTextColor={colors.textMuted}
            multiline value={day.description} onChangeText={(v) => onUpdate({ description: v })} />
          <TextInput style={styles.input} placeholder="Date (optional, e.g. 12 May 2025)"
            placeholderTextColor={colors.textMuted}
            value={day.date} onChangeText={(v) => onUpdate({ date: v })} />

          {day.entries.map((e) => (
            <TouchableOpacity key={e.id} style={styles.entryRow} onPress={() => onEditEntry(e)} activeOpacity={0.8}>
              <Ionicons name={kindIcon(e.kind)} size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle} numberOfLines={1}>{e.title || `${capitalize(e.kind)} (untitled)`}</Text>
                <Text style={styles.entryMeta} numberOfLines={1}>
                  {[e.location_name, e.time, e.cost].filter(Boolean).join(" · ") || capitalize(e.kind)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onRemoveEntry(e.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          <Text style={styles.addEntryHint}>Add to this day</Text>
          <View style={styles.addEntryRow}>
            {ENTRY_KINDS.map((k) => (
              <TouchableOpacity key={k.id} style={styles.addEntryBtn} onPress={() => onAddEntry(k.id as Entry["kind"])}>
                <Ionicons name={k.icon} size={14} color={colors.primary} />
                <Text style={styles.addEntryText}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.removeDayBtn} onPress={onRemove}>
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={styles.removeDayText}>Remove this day</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function EntryEditor({ entry, onClose, onSave }: { entry: Entry; onClose: () => void; onSave: (e: Entry) => void }) {
  const [draft, setDraft] = useState<Entry>(entry);
  const [searchQ, setSearchQ] = useState(entry.location_name);
  const [searchResults, setSearchResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim() || searchQ === draft.location_name) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQ)}&format=json&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQ, draft.location_name]);

  const pickResult = (r: { display_name: string; lat: string; lon: string }) => {
    setDraft((d) => ({ ...d, location_name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
    setSearchQ(r.display_name);
    setSearchResults([]);
  };

  const useGPS = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert("Permission denied"); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json`
      );
      const j = await r.json();
      const name = j.display_name || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
      setDraft((d) => ({ ...d, lat: loc.coords.latitude, lng: loc.coords.longitude, location_name: name }));
      setSearchQ(name);
    } catch { Alert.alert("Could not fetch location"); }
  }, []);

  const addPhoto = async () => {
    const newPhotos = await pickAndCompress({ multi: true, maxWidth: 1100, quality: 0.55 });
    if (newPhotos.length > 0) {
      setDraft((d) => ({ ...d, photos: [...d.photos, ...newPhotos].slice(0, 4) }));
    }
  };

  const removePhoto = (idx: number) =>
    setDraft((d) => ({ ...d, photos: d.photos.filter((_, i) => i !== idx) }));

  const setKind = (k: Entry["kind"]) => setDraft((d) => ({ ...d, kind: k }));
  const setRating = (r: number) => setDraft((d) => ({ ...d, rating: r === d.rating ? 0 : r }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} testID="entry-cancel"><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{entry.title ? "Edit entry" : "New entry"}</Text>
          <TouchableOpacity testID="entry-save" onPress={() => onSave(draft)}>
            <Text style={[styles.modalSave, !draft.title.trim() && { opacity: 0.4 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <View style={styles.kindRow}>
            {ENTRY_KINDS.map((k) => (
              <TouchableOpacity key={k.id} onPress={() => setKind(k.id as Entry["kind"])}
                style={[styles.kindBtn, draft.kind === k.id && styles.kindBtnActive]}>
                <Ionicons name={k.icon} size={16} color={draft.kind === k.id ? "#000" : colors.text} />
                <Text style={[styles.kindBtnText, draft.kind === k.id && { color: "#000" }]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Title *</Text>
          <TextInput testID="entry-title" style={styles.input}
            placeholder={kindPlaceholder(draft.kind)} placeholderTextColor={colors.textMuted}
            value={draft.title} onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="Tell the story" placeholderTextColor={colors.textMuted} multiline
            value={draft.description} onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))} />

          <Text style={styles.label}>Photos</Text>
          <View style={styles.photoRow}>
            {draft.photos.map((p, i) => (
              <View key={i} style={styles.photoThumbWrap}>
                <Image source={{ uri: p.startsWith("http") ? p : `data:image/jpeg;base64,${p}` }} style={styles.photoThumb} />
                <TouchableOpacity style={styles.photoX} onPress={() => removePhoto(i)}>
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={addPhoto}>
              <Ionicons name="add" size={28} color={colors.primary} />
              <Text style={styles.photoAddText}>Add photo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Location</Text>
          <Text style={styles.helpText}>Search any place worldwide — no live GPS needed</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput testID="entry-loc-search" style={styles.searchInput}
              placeholder="e.g. Old Manali, India" placeholderTextColor={colors.textMuted}
              value={searchQ} onChangeText={setSearchQ} returnKeyType="search" />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          {searchResults.length > 0 && (
            <View style={styles.resultsBox}>
              {searchResults.map((r, i) => (
                <TouchableOpacity key={i} style={styles.resultRow} onPress={() => pickResult(r)}>
                  <Ionicons name="location-outline" size={14} color={colors.primary} />
                  <Text style={styles.resultText} numberOfLines={2}>{r.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {draft.lat && draft.lng ? (
            <View style={styles.pickedBox}>
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={styles.pickedText} numberOfLines={2}>{draft.location_name}</Text>
            </View>
          ) : null}
          <TouchableOpacity testID="entry-gps" style={styles.gpsBtn} onPress={useGPS}>
            <Ionicons name="navigate-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.gpsBtnText}>Use my current location (optional)</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time</Text>
              <TextInput style={styles.input} placeholder="e.g. 9:30 AM" placeholderTextColor={colors.textMuted}
                value={draft.time} onChangeText={(v) => setDraft((d) => ({ ...d, time: v }))} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cost</Text>
              <TextInput style={styles.input} placeholder="e.g. INR 500" placeholderTextColor={colors.textMuted}
                value={draft.cost} onChangeText={(v) => setDraft((d) => ({ ...d, cost: v }))} />
            </View>
          </View>

          <Text style={styles.label}>Rating</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)}>
                <Ionicons name={n <= draft.rating ? "star" : "star-outline"} size={28}
                  color={n <= draft.rating ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="Quick personal notes" placeholderTextColor={colors.textMuted} multiline
            value={draft.notes} onChangeText={(v) => setDraft((d) => ({ ...d, notes: v }))} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const kindIcon = (k: string): any => {
  switch (k) { case "stay": return "bed-outline"; case "food": return "restaurant-outline";
    case "activity": return "sparkles-outline"; default: return "location-outline"; }
};
const kindPlaceholder = (k: string) => {
  switch (k) {
    case "stay": return "e.g. Zostel Manali";
    case "food": return "e.g. Lassi at Lassiwala";
    case "activity": return "e.g. Paragliding at Solang";
    default: return "e.g. Old Manali";
  }
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  overline: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  h1: { color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  stepDots: { flexDirection: "row", gap: 6 },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: colors.surface },
  dotActive: { backgroundColor: colors.primary },
  cover: {
    height: 180, borderRadius: radius.xl, backgroundColor: colors.surface, marginBottom: spacing.md,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  coverEmpty: { alignItems: "center", gap: 6 },
  coverText: { color: colors.text, fontWeight: "800", fontSize: 15 },
  coverSub: { color: colors.textSecondary, fontSize: 12 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.3 },
  helpText: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 13,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#000" },
  addTagBtn: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  visRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  visRowActive: { borderColor: colors.primary, backgroundColor: "rgba(255,105,0,0.06)" },
  visTitle: { color: colors.text, fontWeight: "800" },
  visDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  primaryBtn: {
    marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  primaryBtnText: { color: "#000", fontWeight: "900", fontSize: 15 },
  timelineHeader: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
  summary: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  summarySub: { color: colors.textSecondary, marginTop: 2, fontSize: 12 },
  dayCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md },
  dayBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  dayBadgeText: { color: "#000", fontWeight: "900", fontSize: 12 },
  dayLabel: { color: colors.text, fontWeight: "800", fontSize: 15 },
  dayMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  entryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  entryTitle: { color: colors.text, fontWeight: "800" },
  entryMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  addEntryHint: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2,
    textTransform: "uppercase", marginTop: spacing.md, marginBottom: 6 },
  addEntryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addEntryBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary,
  },
  addEntryText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  removeDayBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", marginTop: spacing.md, paddingHorizontal: 10, paddingVertical: 6,
  },
  removeDayText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  addDayBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,105,0,0.06)", paddingVertical: 16, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary, borderStyle: "dashed",
    marginTop: spacing.sm,
  },
  addDayText: { color: colors.primary, fontWeight: "800" },
  bottomBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", gap: 10, padding: spacing.md, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backBtnText: { color: colors.text, fontWeight: "800" },
  publishBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.pill },
  publishText: { color: "#000", fontWeight: "900", fontSize: 15 },

  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalCancel: { color: colors.textSecondary, fontWeight: "700", fontSize: 14 },
  modalSave: { color: colors.primary, fontWeight: "900", fontSize: 14 },
  modalTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  kindRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  kindBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.surface, paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border },
  kindBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindBtnText: { color: colors.text, fontWeight: "800", fontSize: 12 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumbWrap: { width: 86, height: 86, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  photoThumb: { width: "100%", height: "100%" },
  photoX: {
    position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },
  photoAdd: {
    width: 86, height: 86, borderRadius: radius.md, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  photoAddText: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  resultsBox: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginTop: 4, overflow: "hidden",
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultText: { color: colors.text, flex: 1, fontSize: 13 },
  pickedBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,105,0,0.10)", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.md, marginTop: 4, borderWidth: 1, borderColor: colors.primary,
  },
  pickedText: { color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 },
  gpsBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  gpsBtnText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  starRow: { flexDirection: "row", gap: 4, marginTop: 4 },
});
