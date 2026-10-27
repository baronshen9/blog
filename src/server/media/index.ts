import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "@/server/config";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";

// The image formats the blog accepts, each recognized by the signature at the
// start of the file rather than by its name or declared type. SVG is not
// accepted: it can carry scripts.
const imageTypes = {
  png: { contentType: "image/png", extension: "png", label: "PNG" },
  jpeg: { contentType: "image/jpeg", extension: "jpg", label: "JPEG" },
  gif: { contentType: "image/gif", extension: "gif", label: "GIF" },
  webp: { contentType: "image/webp", extension: "webp", label: "WebP" },
} as const;
type ImageType = keyof typeof imageTypes;

// The largest image the blog stores. The Server Action request limit in
// next.config.ts leaves room above it for the form's encoding.
export const maxImageBytes = 5 * 1024 * 1024;

// The content types an upload control may offer to pick from.
export const acceptedImageTypes = Object.values(imageTypes).map(
  (type) => type.contentType,
);

export type Image = {
  id: string;
  contentType: string;
  byteSize: number;
  // Where the site serves the image, for use in Markdown.
  path: string;
};

// Stores an uploaded image: the file goes to MEDIA_DIR, named after its id
// and format, and its metadata to the database. Files that are not an
// accepted image, or are larger than the limit, are refused with the reason.
// The file is written first, so a stored row always has its file.
export async function uploadImage(bytes: Uint8Array): Promise<Image> {
  const type = detectType(bytes);
  if (!type) {
    throw new DomainError(
      "VALIDATION",
      `This file is not an accepted image; upload a ${typeList()} file.`,
    );
  }
  if (bytes.byteLength > maxImageBytes) {
    throw new DomainError(
      "VALIDATION",
      `This image is ${megabytes(bytes.byteLength)}; images can be at most ${megabytes(maxImageBytes)}.`,
    );
  }
  const id = randomUUID();
  const dir = getConfig().MEDIA_DIR;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName(id, type)), bytes, { flag: "wx" });
  await getDb().image.create({
    data: { id, type, byteSize: bytes.byteLength },
  });
  return {
    id,
    contentType: imageTypes[type].contentType,
    byteSize: bytes.byteLength,
    path: `/media/${fileName(id, type)}`,
  };
}

// Reads a stored image by the file name in its path. Names that do not
// belong to a stored image are not found.
export async function readImage(
  name: string,
): Promise<{ contentType: string; bytes: Uint8Array }> {
  const notFound = new DomainError("NOT_FOUND", "This image does not exist.");
  const [, id, extension] =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z]+)$/.exec(
      name,
    ) ?? [];
  if (!id) throw notFound;
  const image = await getDb().image.findUnique({ where: { id } });
  if (!image || imageTypes[image.type].extension !== extension) throw notFound;
  const bytes = await readFile(
    join(getConfig().MEDIA_DIR, fileName(id, image.type)),
  );
  return { contentType: imageTypes[image.type].contentType, bytes };
}

function detectType(bytes: Uint8Array): ImageType | undefined {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, i) => bytes[offset + i] === byte);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts(ascii("GIF87a")) || starts(ascii("GIF89a"))) return "gif";
  if (starts(ascii("RIFF")) && starts(ascii("WEBP"), 8)) return "webp";
  return undefined;
}

function fileName(id: string, type: ImageType): string {
  return `${id}.${imageTypes[type].extension}`;
}

function typeList(): string {
  const labels = Object.values(imageTypes).map((type) => type.label);
  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

function megabytes(bytes: number): string {
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}
