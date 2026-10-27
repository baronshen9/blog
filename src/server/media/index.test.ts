import { expect, test } from "vitest";
import { DomainError } from "@/server/errors";
import { maxImageBytes, readImage, uploadImage } from ".";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const ascii = (text: string) => Buffer.from(text, "latin1");

test("stores an image and serves it at its path", async () => {
  const image = await uploadImage(png);

  expect(image).toMatchObject({ contentType: "image/png", byteSize: 70 });
  expect(image.path).toBe(`/media/${image.id}.png`);
  const stored = await readImage(image.path.split("/").pop() ?? "");
  expect(stored.contentType).toBe("image/png");
  expect(Buffer.from(stored.bytes)).toEqual(png);
});

test("recognizes each accepted format by its content", async () => {
  const files = [
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "jpg"],
    [ascii("GIF89a..."), "image/gif", "gif"],
    [ascii("RIFF\0\0\0\0WEBPVP8 "), "image/webp", "webp"],
  ] as const;
  for (const [bytes, contentType, extension] of files) {
    const image = await uploadImage(bytes);
    expect(image.contentType).toBe(contentType);
    expect(image.path).toMatch(new RegExp(`\\.${extension}$`));
  }
});

test("refuses files that are not accepted images, naming the formats", async () => {
  for (const bytes of [
    ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    ascii("plain text"),
    Buffer.alloc(0),
  ]) {
    await expect(uploadImage(bytes)).rejects.toThrow(
      new DomainError(
        "VALIDATION",
        "This file is not an accepted image; upload a PNG, JPEG, GIF, or WebP file.",
      ),
    );
  }
});

test("refuses images above the size limit, naming both sizes", async () => {
  const large = Buffer.alloc(maxImageBytes + 512 * 1024);
  png.copy(large);

  await expect(uploadImage(large)).rejects.toThrow(
    "This image is 5.5 MB; images can be at most 5 MB.",
  );
  await expect(
    uploadImage(large.subarray(0, maxImageBytes)),
  ).resolves.toMatchObject({ byteSize: maxImageBytes });
});

test("finds no image under an unknown or mismatched name", async () => {
  const image = await uploadImage(png);

  for (const name of [
    `${image.id}.gif`,
    `${crypto.randomUUID()}.png`,
    "../secret.png",
    image.id,
  ]) {
    await expect(readImage(name)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});
