import type { Metadata } from "next";
import {
  listCommentsForModeration,
  type ModeratedComment,
} from "@/server/comments";
import { Button, CommentTable, PageTitle } from "@/ui";
import { requireOwner } from "@/app/admin/session";
import { approveCommentAction, rejectCommentAction } from "./actions";
import { RemoveForm } from "./remove-form";
import styles from "./comments.module.css";

export const metadata: Metadata = { title: "Comments" };

// A comment row whose post title opens the post's editor.
function row(comment: ModeratedComment, actions: React.ReactNode) {
  return {
    ...comment,
    post: {
      title: comment.post.title,
      href: `/admin/posts/${comment.post.id}`,
    },
    actions,
  };
}

export default async function CommentsPage() {
  await requireOwner();
  const [pending, approved] = await Promise.all([
    listCommentsForModeration("pending"),
    listCommentsForModeration("approved"),
  ]);
  return (
    <main>
      <PageTitle description="Approved comments appear under their post, oldest first.">
        Comments
      </PageTitle>
      <section aria-labelledby="pending-title" className={styles.section}>
        <h2 id="pending-title" className={styles.heading}>
          Pending ({pending.length})
        </h2>
        <CommentTable
          empty="No comments await moderation."
          comments={pending.map((comment) =>
            row(
              comment,
              <>
                <form action={approveCommentAction}>
                  <input type="hidden" name="id" value={comment.id} />
                  <Button type="submit" variant="primary">
                    Approve
                  </Button>
                </form>
                <form action={rejectCommentAction}>
                  <input type="hidden" name="id" value={comment.id} />
                  <Button type="submit">Reject</Button>
                </form>
              </>,
            ),
          )}
        />
      </section>
      <section aria-labelledby="approved-title" className={styles.section}>
        <h2 id="approved-title" className={styles.heading}>
          Approved ({approved.length})
        </h2>
        <CommentTable
          empty="No approved comments yet."
          comments={approved.map((comment) =>
            row(
              comment,
              <RemoveForm id={comment.id} nickname={comment.nickname} />,
            ),
          )}
        />
      </section>
    </main>
  );
}
