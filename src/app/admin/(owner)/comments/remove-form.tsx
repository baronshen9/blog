"use client";

import type { FormEvent } from "react";
import { Button } from "@/ui";
import { removeCommentAction } from "./actions";

// Removing an approved comment takes it off a public page for good, so the
// owner confirms it first.
export function RemoveForm({ id, nickname }: { id: string; nickname: string }) {
  function confirmRemove(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `Remove the comment by “${nickname}” from its post? This cannot be undone.`,
      )
    ) {
      event.preventDefault();
    }
  }
  return (
    <form action={removeCommentAction} onSubmit={confirmRemove}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger">
        Remove
      </Button>
    </form>
  );
}
