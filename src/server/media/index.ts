import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { getConfig } from "@/server/config";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { isCompleteGif } from "./gif";

// The image formats the blog accepts, recognized by decoding the file rather
// than by its name or declared type. SVG is not accepted: it can carry
// scripts.
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
// and format, and its metadata to the database. Files larger than the limit,
// and files that are not a complete image in an accepted format, are refused
// with the reason. The file is written first, so a stored row always has its
// file.
export async function uploadImage(bytes: Uint8Array): Promise<Image> {
  if (bytes.byteLength > maxImageBytes) {
    throw new DomainError(
      "VALIDATION",
      `This file is ${megabytes(bytes.byteLength)}; images can be at most ${megabytes(maxImageBytes)}.`,
    );
  }
  const type = await decodedType(bytes);
  if (!type) {
    throw new DomainError(
      "VALIDATION",
      `This file is not an accepted image; upload a ${typeList()} file.`,
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

// The format of an image in an accepted format that decodes completely, every
// frame of an animation included, so a truncated or corrupt file is refused
// rather than stored and shown broken.
async function decodedType(bytes: Uint8Array): Promise<ImageType | undefined> {
  try {
    const image = sharp(bytes, { animated: true });
    const { format } = await image.metadata();
    if (!Object.hasOwn(imageTypes, format)) return undefined;
    await image.stats();
    if (format === "gif" && !isCompleteGif(bytes)) return undefined;
    return format as ImageType;
  } catch {
    return undefined;
  }
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
