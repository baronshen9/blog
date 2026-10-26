// Runs once when the server starts, before it handles requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getConfig } = await import("@/server/config");
  const { ensureOwner } = await import("@/server/auth");
  const config = getConfig();
  await ensureOwner({
    username: config.OWNER_USERNAME,
    password: config.OWNER_PASSWORD,
  });
}
