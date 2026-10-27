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
