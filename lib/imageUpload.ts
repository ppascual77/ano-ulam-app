// A local photo (file:// uri from the picker, camera or ImageManipulator)
// ready for supabase.storage.upload. React Native Blobs lose their content
// type on the way up (every photo uploaded as a Blob was stored as
// text/plain, even with contentType set), so this sends the raw bytes as an
// ArrayBuffer with the type taken from the file extension.

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

export async function readImageForUpload(localUri: string): Promise<{ body: ArrayBuffer; contentType: string; ext: string }> {
  const raw = localUri.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const ext = TYPES[raw] ? raw : "jpg";
  const body = await (await fetch(localUri)).arrayBuffer();
  return { body, contentType: TYPES[ext], ext };
}
