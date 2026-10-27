import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";

export type ApiToken = {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

// The longest name the admin accepts; names are labels, not descriptions.
export const tokenNameMaxLength = 100;

const tokenFields = {
  id: true,
  name: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

// Creates a named token and returns its secret, which exists only in this
// return value: the database keeps its SHA-256 hash, so it cannot be shown
// again.
export async function createToken(
  name: string,
): Promise<{ token: ApiToken; secret: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new DomainError("VALIDATION", "Give the token a name.");
  }
  if (trimmed.length > tokenNameMaxLength) {
    throw new DomainError(
      "VALIDATION",
      `Keep the name within ${tokenNameMaxLength} characters.`,
    );
  }
  const secret = randomBytes(32).toString("base64url");
  const token = await getDb().apiToken.create({
    data: { name: trimmed, tokenHash: hashSecret(secret) },
    select: tokenFields,
  });
  return { token, secret };
}

// Every token, revoked ones included, newest first; never a secret or hash.
export async function listTokens(): Promise<ApiToken[]> {
  return getDb().apiToken.findMany({
    select: tokenFields,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

// Revokes a token from this moment on. The row stays for the list; revoking
// it again keeps the first revocation time.
export async function revokeToken(id: string): Promise<ApiToken> {
  const db = getDb();
  await db.apiToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const token = await db.apiToken.findUnique({
    where: { id },
    select: tokenFields,
  });
  if (!token) throw new DomainError("NOT_FOUND", "This token does not exist.");
  return token;
}

// The API's access check: accepts the secret of a token that is not revoked
// and records its use. The lookup and the revocation check are one statement,
// so a token revoked before it runs is refused. Unknown and revoked secrets
// get the same error.
export async function verifyToken(secret: string): Promise<ApiToken> {
  const [token] = await getDb().apiToken.updateManyAndReturn({
    where: { tokenHash: hashSecret(secret), revokedAt: null },
    data: { lastUsedAt: new Date() },
    select: tokenFields,
  });
  if (!token) {
    throw new DomainError("UNAUTHORIZED", "A valid API token is required.");
  }
  return token;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
