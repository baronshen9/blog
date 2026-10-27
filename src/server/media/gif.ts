// Whether a GIF's block structure is complete: every block is whole and the
// trailer follows the last one. The decoder tolerates a truncated later frame
// of an animation, showing whatever part arrived, so decoding alone does not
// reveal one.
export function isCompleteGif(bytes: Uint8Array): boolean {
  // Header (6 bytes) and logical screen descriptor (7 bytes).
  const screen = bytes[10];
  if (screen === undefined || bytes.byteLength < 13) return false;
  let at = 13 + colorTableSize(screen);
  for (;;) {
    const introducer = bytes[at];
    if (introducer === 0x3b) return true;
    if (introducer === 0x21) {
      // Extension: label, then data sub-blocks.
      at = afterSubBlocks(bytes, at + 2);
    } else if (introducer === 0x2c) {
      // Image: descriptor (10 bytes), local color table, LZW minimum code
      // size, then data sub-blocks.
      const image = bytes[at + 9];
      if (image === undefined) return false;
      at = afterSubBlocks(bytes, at + 10 + colorTableSize(image) + 1);
    } else {
      // Another byte, or the end of the file before the trailer.
      return false;
    }
  }
}

// The size of the color table that a packed descriptor field announces.
function colorTableSize(packed: number): number {
  return packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0;
}

// The position after the sub-blocks starting at `at`, which end with an empty
// block. A run that is cut off yields the end of the file.
function afterSubBlocks(bytes: Uint8Array, at: number): number {
  for (let size = bytes[at]; size !== undefined; size = bytes[at]) {
    at += 1 + size;
    if (size === 0) return at;
  }
  return bytes.byteLength;
}
