import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "./theme";

const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "AED", symbol: "د.إ" },
  { code: "SGD", symbol: "S$" },
];

// ====================== DATE ======================
export function isValidDate(v: string): boolean {
  if (!v) return true;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900 || yy > 2100) return false;
  const dt = new Date(yy, mm - 1, dd);
  return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd;
}

function maskDate(s: string): string {
  const digits = s.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInput({
  value, onChangeText, testID, placeholder = "DD/MM/YYYY",
}: { value: string; onChangeText: (v: string) => void; testID?: string; placeholder?: string }) {
  const [touched, setTouched] = useState(!!value);
  const valid = isValidDate(value || "");
  const showError = touched && !!value && !valid;
  return (
    <View>
      <View style={[styles.inputRow, showError && styles.inputRowError, !!value && valid && styles.inputRowOk]}>
        <Ionicons name="calendar-outline" size={16} color={showError ? colors.danger : colors.textMuted} />
        <TextInput
          testID={testID}
          style={styles.inputField}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          keyboardType="number-pad"
          maxLength={10}
          onBlur={() => setTouched(true)}
          onChangeText={(v) => onChangeText(maskDate(v))}
        />
        {!!value && valid && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
        {showError && <Ionicons name="alert-circle" size={16} color={colors.danger} />}
      </View>
      {showError && <Text style={styles.errorText}>Use DD/MM/YYYY (e.g. 12/05/2025)</Text>}
    </View>
  );
}

// ====================== TIME ======================
export function isValidTime(v: string): boolean {
  if (!v) return true;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!m) return false;
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  return hh >= 1 && hh <= 12 && mm >= 0 && mm <= 59;
}

function maskTime(s: string): string {
  // Allow user to type freely; we'll normalize on output
  const upper = s.toUpperCase();
  const ampm = upper.match(/(AM|PM)\s*$/)?.[1] || "";
  const numPart = upper.replace(/(AM|PM)/g, "").replace(/[^0-9:]/g, "");
  // Insert colon after 2 digits if not present
  let formatted = numPart;
  if (!numPart.includes(":")) {
    const digits = numPart.replace(/[^0-9]/g, "").slice(0, 4);
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    else formatted = digits;
  } else {
    const [h, m = ""] = numPart.split(":");
    formatted = `${h.slice(0, 2)}:${m.slice(0, 2)}`;
  }
  return ampm ? `${formatted} ${ampm}` : formatted;
}

export function TimeInput({
  value, onChangeText, testID,
}: { value: string; onChangeText: (v: string) => void; testID?: string }) {
  const [touched, setTouched] = useState(!!value);
  const valid = isValidTime(value || "");
  const showError = touched && !!value && !valid;
  const ampm = (value?.match(/(AM|PM)\s*$/i)?.[1] || "").toUpperCase();

  const setAmPm = (kind: "AM" | "PM") => {
    const numPart = (value || "").replace(/\s?(AM|PM)$/i, "").trim();
    if (!numPart) return;
    onChangeText(`${numPart} ${kind}`);
  };

  return (
    <View>
      <View style={[styles.inputRow, showError && styles.inputRowError, !!value && valid && styles.inputRowOk]}>
        <Ionicons name="time-outline" size={16} color={showError ? colors.danger : colors.textMuted} />
        <TextInput
          testID={testID}
          style={styles.inputField}
          placeholder="9:30 AM"
          placeholderTextColor={colors.textMuted}
          value={value}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect={false}
          onBlur={() => setTouched(true)}
          onChangeText={(v) => onChangeText(maskTime(v))}
        />
        {!!value && valid && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
        {showError && <Ionicons name="alert-circle" size={16} color={colors.danger} />}
      </View>
      <View style={styles.ampmRow}>
        <TouchableOpacity testID={testID ? `${testID}-am` : undefined}
          style={[styles.ampmBtn, ampm === "AM" && styles.ampmBtnActive]}
          onPress={() => setAmPm("AM")}>
          <Text style={[styles.ampmText, ampm === "AM" && styles.ampmTextActive]}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={testID ? `${testID}-pm` : undefined}
          style={[styles.ampmBtn, ampm === "PM" && styles.ampmBtnActive]}
          onPress={() => setAmPm("PM")}>
          <Text style={[styles.ampmText, ampm === "PM" && styles.ampmTextActive]}>PM</Text>
        </TouchableOpacity>
      </View>
      {showError && <Text style={styles.errorText}>Use HH:MM AM/PM (e.g. 9:30 AM)</Text>}
    </View>
  );
}

// ====================== MONEY ======================
export function isValidMoney(v: string): boolean {
  if (!v) return true;
  const m = v.trim().match(/^([A-Z]{3})\s+([\d,]+(?:\.\d{1,2})?)$/);
  if (!m) return false;
  if (!CURRENCIES.some((c) => c.code === m[1])) return false;
  const num = parseFloat(m[2].replace(/,/g, ""));
  return !isNaN(num) && num >= 0;
}

function formatAmount(s: string): string {
  const cleaned = s.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  let intPart = firstDot < 0 ? cleaned : cleaned.slice(0, firstDot);
  let decPart = firstDot < 0 ? "" : cleaned.slice(firstDot).replace(/\./g, (m, i) => (i === 0 ? "." : ""));
  intPart = intPart.replace(/^0+(?=\d)/, "");
  decPart = decPart.slice(0, 3); // ".dd"
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return withCommas + decPart;
}

export function MoneyInput({
  value, onChangeText, testID,
}: { value: string; onChangeText: (v: string) => void; testID?: string }) {
  const parsed = (value || "").trim().match(/^([A-Z]{3})\s+(.+)$/);
  const [currency, setCurrency] = useState(parsed ? parsed[1] : "INR");
  const [amount, setAmount] = useState(parsed ? parsed[2] : "");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Push changes up
  useEffect(() => {
    const next = amount ? `${currency} ${amount}` : "";
    if (next !== value) onChangeText(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, amount]);

  // Sync from external value changes (e.g. loading draft)
  useEffect(() => {
    const p = (value || "").trim().match(/^([A-Z]{3})\s+(.+)$/);
    const c = p ? p[1] : "INR";
    const a = p ? p[2] : "";
    if (c !== currency) setCurrency(c);
    if (a !== amount) setAmount(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol || "₹";
  const valid = !value || isValidMoney(value);

  return (
    <View>
      <View style={[styles.moneyRow, !!value && valid && styles.inputRowOk]}>
        <TouchableOpacity
          testID={testID ? `${testID}-currency` : undefined}
          style={styles.currencyBtn} onPress={() => setPickerOpen((p) => !p)}>
          <Text style={styles.currencySym}>{sym}</Text>
          <Text style={styles.currencyCode}>{currency}</Text>
          <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={12} color={colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          testID={testID}
          style={[styles.inputField, { flex: 1 }]}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={amount}
          keyboardType="decimal-pad"
          onChangeText={(v) => setAmount(formatAmount(v))}
        />
        {!!value && valid && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
      </View>
      {pickerOpen && (
        <View style={styles.currencyList}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity key={c.code}
              testID={testID ? `${testID}-currency-${c.code}` : undefined}
              style={[styles.currencyItem, currency === c.code && styles.currencyItemActive]}
              onPress={() => { setCurrency(c.code); setPickerOpen(false); }}>
              <Text style={[styles.currencyItemSym, currency === c.code && { color: "#000" }]}>{c.symbol}</Text>
              <Text style={[styles.currencyItemCode, currency === c.code && { color: "#000" }]}>{c.code}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ====================== STYLES ======================
const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 11,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 4,
  },
  inputRowError: { borderColor: colors.danger },
  inputRowOk: { borderColor: "rgba(255,105,0,0.55)" },
  inputField: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 2, marginBottom: 4 },
  ampmRow: { flexDirection: "row", gap: 6, marginTop: 6, marginBottom: 4 },
  ampmBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  ampmBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ampmText: { color: colors.text, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  ampmTextActive: { color: "#000" },
  moneyRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 5,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 4,
  },
  currencyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  currencySym: { color: colors.primary, fontWeight: "900", fontSize: 13 },
  currencyCode: { color: colors.text, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  currencyList: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: 4, padding: 6, flexDirection: "row", flexWrap: "wrap", gap: 6,
  },
  currencyItem: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  currencyItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencyItemSym: { color: colors.primary, fontWeight: "900", fontSize: 13 },
  currencyItemCode: { color: colors.text, fontWeight: "800", fontSize: 11 },
});
