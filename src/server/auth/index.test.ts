import { beforeEach, expect, test } from "vitest";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { ensureOwner, getSessionOwner, signIn, signOut } from ".";

const owner = { username: "owner", password: "correct horse battery" };

beforeEach(async () => {
  await ensureOwner(owner);
});

test("creates the owner once with a hashed password and never overwrites it", async () => {
  await ensureOwner({ username: "someone-else", password: "another password" });

  const owners = await getDb().owner.findMany();
  expect(owners).toHaveLength(1);
  expect(owners[0]?.username).toBe(owner.username);
  expect(owners[0]?.passwordHash).toMatch(/^\$argon2id\$/);
  await expect(signIn(owner)).resolves.toHaveProperty("token");
});

test("signs in with the owner's credentials and stores only the token hash", async () => {
  const { token } = await signIn(owner);

  await expect(getSessionOwner(token)).resolves.toMatchObject({
    username: owner.username,
  });
  const [session] = await getDb().session.findMany();
  expect(session?.tokenHash).not.toContain(token);
});

test.each([
  ["a wrong password", { ...owner, password: "wrong password" }],
  ["an unknown username", { ...owner, username: "nobody" }],
])("refuses %s with the same generic error", async (_, credentials) => {
  const error = await signIn(credentials).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({
    code: "UNAUTHORIZED",
    message: "Incorrect username or password.",
  });
  expect(await getDb().session.count()).toBe(0);
});

test("refuses an expired session", async () => {
  const { token } = await signIn(owner);
  await getDb().session.updateMany({ data: { expiresAt: new Date() } });

  await expect(getSessionOwner(token)).resolves.toBeNull();
});

test("signing out ends the session", async () => {
  const { token } = await signIn(owner);
  const other = await signIn(owner);

  await signOut(token);

  await expect(getSessionOwner(token)).resolves.toBeNull();
  await expect(getSessionOwner(other.token)).resolves.not.toBeNull();
});
