import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

// Meal photos are small catalog thumbnails, not print assets — keeping
// every upload well under this cap matters more than resolution, both for
// Storage cost and for how fast they load in Home/Browse/Discover's lists.
const MAX_BYTES = 150 * 1024;

// Paired width+quality steps, tried in order until one lands under
// MAX_BYTES. Stepping DOWN the max dimension across attempts (not just
// quality) converges much faster than quality alone for a full-resolution
// camera photo or a 1024px+ AI-generated image — a huge image at low JPEG
// quality still often exceeds 150KB from sheer pixel count.
const STEPS: { width: number; quality: number }[] = [
  { width: 1200, quality: 0.7 },
  { width: 1000, quality: 0.6 },
  { width: 800, quality: 0.5 },
  { width: 650, quality: 0.4 },
  { width: 500, quality: 0.3 },
  { width: 400, quality: 0.25 },
];

// Compresses a local image file (picked from the library or written from an
// AI-generated result) down to ~150KB before it goes to Storage. Best
// effort: an unusually busy/high-detail source at the smallest step tried
// still gets uploaded rather than blocking on a target that's inherently
// approximate for photographic content — never throws over the size cap
// itself.
export async function compressImageForUpload(localUri: string): Promise<string> {
  let smallest = localUri;
  let smallestSize = Infinity;

  for (const step of STEPS) {
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: step.width } }],
      { compress: step.quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    const info = await FileSystem.getInfoAsync(result.uri);
    const size = info.exists ? (info.size ?? Infinity) : Infinity;

    if (size <= MAX_BYTES) return result.uri;
    if (size < smallestSize) {
      smallest = result.uri;
      smallestSize = size;
    }
  }

  return smallest;
}

// Writes a base64-encoded image (from generate-meal-image's response) to a
// temp file so it can go through the same compress-then-upload pipeline as
// a manually-picked image, rather than a separate upload path.
export async function base64ToTempFile(base64: string, extension: string): Promise<string> {
  const path = `${FileSystem.cacheDirectory}ai-meal-image-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}
