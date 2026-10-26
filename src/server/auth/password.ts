import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(argon2);

// OWASP minimum for argon2id: 19 MiB of memory, two passes, one lane.
const params = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 };

// Stored in the PHC string format that other argon2 implementations read:
// $argon2id$v=19$m=<KiB>,t=<passes>,p=<lanes>$<salt>$<hash>
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const hash = await derive("argon2id", {
    ...params,
    message: password,
    nonce,
  });
  const { memory: m, passes: t, parallelism: p } = params;
  return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64(nonce)}$${b64(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
      stored,
    );
  if (!match) throw new Error("unsupported password hash format");
  const [m, t, p, salt, hash] = match.slice(1) as [
    string,
    string,
    string,
    string,
    string,
  ];
  const expected = Buffer.from(hash, "base64");
  const actual = await derive("argon2id", {
    message: password,
    nonce: Buffer.from(salt, "base64"),
    memory: Number(m),
    passes: Number(t),
    parallelism: Number(p),
    tagLength: expected.length,
  });
  return timingSafeEqual(actual, expected);
}

const b64 = (bytes: Buffer): string =>
  bytes.toString("base64").replace(/=+$/, "");
