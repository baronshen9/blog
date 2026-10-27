import sharp from "sharp";
import { expect, test } from "vitest";
import { DomainError } from "@/server/errors";
import { maxImageBytes, readImage, uploadImage } from ".";

const formats = ["png", "jpeg", "gif", "webp"] as const;

// A small, complete image in the given format.
function image(format: (typeof formats)[number]): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: "#000000",
      noise: { type: "gaussian", mean: 128, sigma: 30 },
    },
  })
    .toFormat(format)
    .toBuffer();
}

// A small, complete animation of two frames in the given format.
function animation(format: "gif" | "webp"): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 128,
      pageHeight: 64,
      channels: 3,
      background: "#000000",
      noise: { type: "gaussian", mean: 128, sigma: 30 },
    },
  })
    .toFormat(format)
    .toBuffer();
}

// The GIF with its last frame's compressed data removed and its block
// structure kept whole, so only the frame's pixel count shows the damage.
function withEmptyLastFrame(gif: Buffer): Buffer {
  const byte = (at: number) => gif[at] ?? 0;
  const colorTable = (packed: number) =>
    packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0;
  let at = 13 + colorTable(byte(10));
  let lastData = 0;
  while (byte(at) !== 0x3b) {
    if (byte(at) === 0x2c) {
      at += 10 + colorTable(byte(at + 9)) + 1;
      lastData = at;
    } else {
      at += 2;
    }
    while (byte(at) !== 0) at += 1 + byte(at);
    at += 1;
  }
  return Buffer.concat([gif.subarray(0, lastData), Buffer.from([0x00, 0x3b])]);
}

const notAnImage = new DomainError(
  "VALIDATION",
  "This file is not an accepted image; upload a PNG, JPEG, GIF, or WebP file.",
);

test("stores an image and serves it at its path", async () => {
  const png = await image("png");
  const stored = await uploadImage(png);

  expect(stored).toMatchObject({
    contentType: "image/png",
    byteSize: png.byteLength,
  });
  expect(stored.path).toBe(`/media/${stored.id}.png`);
  const read = await readImage(stored.path.split("/").pop() ?? "");
  expect(read.contentType).toBe("image/png");
  expect(Buffer.from(read.bytes)).toEqual(png);
});

test("accepts each format by its content", async () => {
  const extensions = { png: "png", jpeg: "jpg", gif: "gif", webp: "webp" };
  for (const format of formats) {
    const stored = await uploadImage(await image(format));
    expect(stored.contentType).toBe(`image/${format}`);
    expect(stored.path).toMatch(new RegExp(`\\.${extensions[format]}$`));
  }
});

test("refuses files that are not accepted images, naming the formats", async () => {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2'/>";
  for (const bytes of [
    Buffer.from(svg),
    Buffer.from("plain text"),
    Buffer.alloc(0),
    await sharp(await image("png"))
      .tiff()
      .toBuffer(),
  ]) {
    await expect(uploadImage(bytes)).rejects.toThrow(notAnImage);
  }
});

test("refuses truncated and signature-only images", async () => {
  for (const format of formats) {
    const bytes = await image(format);
    for (const part of [
      bytes.subarray(0, Math.floor(bytes.byteLength * 0.8)),
      bytes.subarray(0, 8),
    ]) {
      await expect(uploadImage(part)).rejects.toThrow(notAnImage);
    }
  }
});

test("accepts animated GIF and WebP images", async () => {
  for (const format of ["gif", "webp"] as const) {
    const stored = await uploadImage(await animation(format));
    expect(stored.contentType).toBe(`image/${format}`);
  }
});

test("refuses animations whose later frame is damaged", async () => {
  const damaged = [];
  for (const format of ["gif", "webp"] as const) {
    // The second frame's data fills the second half of the file.
    const bytes = await animation(format);
    const corrupt = Buffer.from(bytes);
    corrupt.fill(
      0xff,
      Math.floor(bytes.byteLength * 0.7),
      Math.floor(bytes.byteLength * 0.9),
    );
    damaged.push(corrupt);
    if (format === "gif") {
      damaged.push(
        bytes.subarray(0, Math.floor(bytes.byteLength * 0.8)),
        withEmptyLastFrame(bytes),
      );
    }
  }
  for (const bytes of damaged) {
    await expect(uploadImage(bytes)).rejects.toThrow(notAnImage);
  }
});

test("refuses files above the size limit, naming both sizes", async () => {
  await expect(
    uploadImage(Buffer.alloc(maxImageBytes + 512 * 1024)),
  ).rejects.toThrow(
    new DomainError(
      "VALIDATION",
      "This file is 5.5 MB; images can be at most 5 MB.",
    ),
  );
});

test("finds no image under an unknown or mismatched name", async () => {
  const stored = await uploadImage(await image("png"));

  for (const name of [
    `${stored.id}.gif`,
    `${crypto.randomUUID()}.png`,
    "../secret.png",
    stored.id,
  ]) {
    await expect(readImage(name)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});
