import { expect, test } from "@playwright/test";

test("the running blog reaches its database", async ({ request }) => {
  const response = await request.get("/healthz");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
