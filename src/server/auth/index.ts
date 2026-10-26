import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { hashPassword, verifyPassword } from "./password";

export type Owner = { id: string; username: string };
export type Credentials = { username: string; password: string };

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

// Creates the owner on first start; an existing owner is never changed, so
// editing OWNER_* later does not reset the password.
export async function ensureOwner({ username, password }: Credentials) {
  const db = getDb();
  if ((await db.owner.count()) > 0) return;
  await db.owner.create({
    data: { username, passwordHash: await hashPassword(password) },
  });
  console.info(`auth: created owner "${username}"`);
}

// One message for an unknown username and a wrong password, and a hash
// comparison in both cases, so neither the answer nor its timing tells which
// part was wrong.
export async function signIn({
  username,
  password,
}: Credentials): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const owner = await db.owner.findUnique({ where: { username } });
  const valid = await verifyPassword(
    password,
    owner?.passwordHash ?? (await unknownUserHash()),
  );
  if (!owner || !valid) {
    throw new DomainError("UNAUTHORIZED", "Incorrect username or password.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
  await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.session.create({
    data: { tokenHash: hashToken(token), ownerId: owner.id, expiresAt },
  });
  return { token, expiresAt };
}

export async function getSessionOwner(token: string): Promise<Owner | null> {
  const session = await getDb().session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      owner: { select: { id: true, username: true } },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.owner;
}

export async function signOut(token: string): Promise<void> {
  await getDb().session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

let unknownUser: Promise<string> | undefined;
function unknownUserHash(): Promise<string> {
  unknownUser ??= hashPassword(randomBytes(32).toString("base64url"));
  return unknownUser;
}
