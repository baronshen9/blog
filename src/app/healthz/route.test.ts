import { expect, test } from "vitest";
import { GET } from "./route";

test("reports ok while the database is reachable", async () => {
  const response = await GET();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
