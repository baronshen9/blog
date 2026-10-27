"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { createToken, revokeToken } from "@/server/tokens";
import { requireOwner } from "@/app/admin/session";

// `created` carries the new token's secret to this one response only; `name`
// comes back after an error so the form can keep it after React resets it.
export type TokenFormState = {
  created?: { name: string; secret: string };
  error?: string;
  name?: string;
};

export async function createTokenAction(
  _previous: TokenFormState,
  form: FormData,
): Promise<TokenFormState> {
  await requireOwner();
  const input = z.object({ name: z.string() }).safeParse({
    name: form.get("name"),
  });
  if (!input.success) return { error: "The form is invalid; reload the page." };
  try {
    const { token, secret } = await createToken(input.data.name);
    refresh();
    return { created: { name: token.name, secret } };
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message, name: input.data.name };
    }
    throw error;
  }
}

export async function revokeTokenAction(form: FormData): Promise<void> {
  await requireOwner();
  const id = z.uuid().parse(form.get("id"));
  await revokeToken(id);
  refresh();
}
