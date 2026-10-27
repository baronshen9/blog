import type { Metadata } from "next";
import { listTokens, tokenNameMaxLength } from "@/server/tokens";
import { PageTitle, TokenTable } from "@/ui";
import { requireOwner } from "@/app/admin/session";
import { revokeTokenAction } from "./actions";
import { TokenForm } from "./token-form";

export const metadata: Metadata = { title: "API tokens" };

export default async function TokensPage() {
  await requireOwner();
  const tokens = await listTokens();
  return (
    <main>
      <PageTitle description="AI assistants use a token to manage posts without your password. Revoking a token refuses it at once.">
        API tokens
      </PageTitle>
      <TokenForm nameMaxLength={tokenNameMaxLength} />
      <TokenTable tokens={tokens} revokeAction={revokeTokenAction} />
    </main>
  );
}
