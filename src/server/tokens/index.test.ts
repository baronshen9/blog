import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { createToken, listTokens, revokeToken, verifyToken } from ".";

async function refusal(secret: string) {
  const error = await verifyToken(secret).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({
    code: "UNAUTHORIZED",
    message: "A valid API token is required.",
  });
}

test("creates a named token whose secret is stored only as a hash", async () => {
  const { token, secret } = await createToken("  Claude Code  ");

  expect(token).toMatchObject({
    name: "Claude Code",
    lastUsedAt: null,
    revokedAt: null,
  });
  expect(secret.length).toBeGreaterThanOrEqual(43);
  const [row] = await getDb().apiToken.findMany();
  expect(row?.tokenHash).not.toContain(secret);
  expect(JSON.stringify(await listTokens())).not.toContain(secret);
});

test.each([
  ["an empty name", "   ", "Give the token a name."],
  ["a long name", "x".repeat(101), "Keep the name within 100 characters."],
])("refuses %s", async (_, name, message) => {
  await expect(createToken(name)).rejects.toMatchObject({
    code: "VALIDATION",
    message,
  });
  expect(await getDb().apiToken.count()).toBe(0);
});

test("lists tokens newest first with their use and revocation", async () => {
  const first = await createToken("Codex");
  const second = await createToken("Claude Code");
  await getDb().apiToken.update({
    where: { id: first.token.id },
    data: { createdAt: new Date(Date.UTC(2026, 0, 1)) },
  });
  await verifyToken(second.secret);
  await revokeToken(first.token.id);

  const tokens = await listTokens();

  expect(tokens.map((token) => token.name)).toEqual(["Claude Code", "Codex"]);
  expect(tokens[0]?.lastUsedAt).toBeInstanceOf(Date);
  expect(tokens[0]?.revokedAt).toBeNull();
  expect(tokens[1]?.lastUsedAt).toBeNull();
  expect(tokens[1]?.revokedAt).toBeInstanceOf(Date);
  expect(Object.keys(tokens[0] ?? {})).not.toContain("tokenHash");
});

test("verifies a token by its secret and records the use", async () => {
  const { token, secret } = await createToken("Claude Code");

  const verified = await verifyToken(secret);

  expect(verified).toMatchObject({ id: token.id, name: "Claude Code" });
  expect(verified.lastUsedAt).toBeInstanceOf(Date);
});

test("refuses a secret that matches no stored hash", async () => {
  const { secret } = await createToken("Claude Code");

  await refusal(`${secret}x`);
  await refusal("");
  const [row] = await getDb().apiToken.findMany();
  expect(row?.lastUsedAt).toBeNull();
});

test("refuses a revoked token from the moment it is revoked", async () => {
  const { token, secret } = await createToken("Claude Code");
  const other = await createToken("Codex");
  await verifyToken(secret);

  const revoked = await revokeToken(token.id);

  expect(revoked.revokedAt).toBeInstanceOf(Date);
  await refusal(secret);
  await expect(verifyToken(other.secret)).resolves.toMatchObject({
    name: "Codex",
  });
});

test("revoking again keeps the first revocation time", async () => {
  const { token } = await createToken("Claude Code");
  const first = await revokeToken(token.id);

  const again = await revokeToken(token.id);

  expect(again.revokedAt).toEqual(first.revokedAt);
});

test("revoking an unknown token is not found", async () => {
  await expect(revokeToken(randomUUID())).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
