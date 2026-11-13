import * as ImageManipulator from "expo-image-manipulator";

// Community photos are shown full width in the feed, so they keep more
// detail than recipe covers (compressImageForUpload's ~150 KB catalog
// thumbnails): the long side capped at 1600 px, JPEG at 75%. A 12 MP phone
// photo (3 to 4 MB straight from the picker) comes out around 300 to 500 KB,
// several times faster to upload and well under the bucket's 10 MB limit.
const LONG_SIDE = 1600;
const QUALITY = 0.75;

/** A local photo resized and compressed for a post. `width`/`height` are the
 *  picked photo's size (from the picker), to know which side is long. */
export async function compressPostPhoto(localUri: string, width?: number, height?: number): Promise<string> {
  const portrait = !!width && !!height && height > width;
  const longSide = portrait ? height : width;
  const actions: ImageManipulator.Action[] =
    longSide && longSide <= LONG_SIDE ? [] : [{ resize: portrait ? { height: LONG_SIDE } : { width: LONG_SIDE } }];
  const result = await ImageManipulator.manipulateAsync(localUri, actions, {
    compress: QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
