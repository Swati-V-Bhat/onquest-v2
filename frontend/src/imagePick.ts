import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Pick image(s) and return base64 strings, resized to max 1100px width
 * to keep payloads manageable when posted to the backend.
 */
export async function pickAndCompress(opts?: {
  multi?: boolean;
  maxWidth?: number;
  quality?: number;
}): Promise<string[]> {
  const { multi = false, maxWidth = 1100, quality = 0.6 } = opts || {};
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    base64: false,
    quality: 0.8,
    allowsMultipleSelection: multi,
    selectionLimit: multi ? 6 : 1,
  });
  if (res.canceled) return [];
  const out: string[] = [];
  for (const a of res.assets) {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        a.uri,
        [{ resize: { width: maxWidth } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipulated.base64) out.push(manipulated.base64);
    } catch {
      // fallback: use raw if manipulator fails
      if ((a as any).base64) out.push((a as any).base64);
    }
  }
  return out;
}
