"use client";

import type { FormEvent } from "react";
import { Button } from "@/ui";
import { deletePostAction } from "./actions";

// Deleting permanently cannot be undone, so the owner confirms it first.
export function DeleteForm({ id, title }: { id: string; title: string }) {
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(`Delete “${title}” permanently? This cannot be undone.`)
    ) {
      event.preventDefault();
    }
  }
  return (
    <form action={deletePostAction} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger">
        Delete permanently
      </Button>
    </form>
  );
}
