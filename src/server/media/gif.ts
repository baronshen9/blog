// Whether a GIF is complete: every block is whole, the trailer follows the
// last one, and every frame's compressed data holds all of its pixels. The
// decoder shows a frame whose data ends early, or a truncated later frame of
// an animation, with the missing part blank, so decoding alone does not
// reveal either.
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
      at = subBlocks(bytes, at + 2).end;
    } else if (introducer === 0x2c) {
      // Image: descriptor (10 bytes), local color table, LZW minimum code
      // size, then data sub-blocks.
      const packed = bytes[at + 9];
      if (packed === undefined) return false;
      const pixels = word(bytes, at + 5) * word(bytes, at + 7);
      at += 10 + colorTableSize(packed);
      const minCodeSize = bytes[at];
      if (minCodeSize === undefined || minCodeSize < 1 || minCodeSize > 11) {
        return false;
      }
      const data = subBlocks(bytes, at + 1);
      if (decodedLength(data.data, minCodeSize) < pixels) return false;
      at = data.end;
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

function word(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

// The data of the sub-blocks starting at `at`, which end with an empty block,
// and the position after them. A run that is cut off ends at the end of the
// file.
function subBlocks(
  bytes: Uint8Array,
  at: number,
): { data: Uint8Array; end: number } {
  const parts: Uint8Array[] = [];
  for (let size = bytes[at]; size !== undefined; size = bytes[at]) {
    parts.push(bytes.subarray(at + 1, at + 1 + size));
    at += 1 + size;
    if (size === 0) return { data: Buffer.concat(parts), end: at };
  }
  return { data: Buffer.concat(parts), end: bytes.byteLength };
}

// The number of pixels that a frame's LZW data decodes to, counting string
// lengths without building the strings. It stops at the end-of-information
// code, at the end of the data, or at a code no decoder could resolve.
function decodedLength(data: Uint8Array, minCodeSize: number): number {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const lengths = new Uint32Array(4096).fill(1, 0, clear);
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let previous = -1;
  let pixels = 0;
  let bits = 0;
  let bitCount = 0;
  let at = 0;
  for (;;) {
    while (bitCount < codeSize && at < data.byteLength) {
      bits |= (data[at] ?? 0) << bitCount;
      bitCount += 8;
      at += 1;
    }
    if (bitCount < codeSize) return pixels;
    const code = bits & ((1 << codeSize) - 1);
    bits >>>= codeSize;
    bitCount -= codeSize;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = end + 1;
      previous = -1;
      continue;
    }
    if (code === end) return pixels;
    if (previous === -1) {
      if (code > clear) return pixels;
      pixels += 1;
      previous = code;
      continue;
    }
    if (code > next || (code === next && next === 4096)) return pixels;
    const length =
      code === next ? (lengths[previous] ?? 0) + 1 : (lengths[code] ?? 0);
    if (next < 4096) {
      lengths[next] = (lengths[previous] ?? 0) + 1;
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    pixels += length;
    previous = code;
  }
}
