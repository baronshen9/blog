import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { renderMarkdown } from "@/lib";
import {
  listPublicComments,
  messageMaxLength,
  nicknameMaxLength,
} from "@/server/comments";
import { DomainError } from "@/server/errors";
import { getPublishedPost, languages } from "@/server/posts";
import { tagHref } from "@/app/[locale]/tag-href";
import { Card, CommentForm, CommentList, PostMeta, Prose, TagList } from "@/ui";
import { submitCommentAction } from "./actions";

type Params = Promise<{ locale: string; slug: string }>;

// Drafts, trashed, and unknown posts are not found. Rendered on every request
// so that a saved change shows at once.
const loadPost = cache(async (locale: string, slug: string) => {
  await connection();
  const language = z.enum(languages).safeParse(locale);
  if (!language.success) notFound();
  return getPublishedPost(language.data, slug).catch(notFoundIfMissing);
});

// A post that is not, or no longer, published renders the not-found page.
function notFoundIfMissing(error: unknown): never {
  if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
  throw error;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  return { title: (await loadPost(locale, slug)).title };
}

export default async function PostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const post = await loadPost(locale, slug);
  const [body, comments] = await Promise.all([
    renderMarkdown(post.bodyMarkdown),
    listPublicComments(post.language, post.slug).catch(notFoundIfMissing),
  ]);
  return (
    <main>
      <Card
        title={post.title}
        backHref={`/${post.language}`}
        backLabel="All posts"
        meta={
          <>
            <PostMeta publishedAt={post.publishedAt} language={post.language} />
            <TagList tags={post.tags} hrefFor={tagHref(post.language)} />
          </>
        }
      >
        <Prose html={body} />
      </Card>
      <CommentList comments={comments} />
      <CommentForm
        submit={submitCommentAction.bind(null, {
          language: post.language,
          slug: post.slug,
        })}
        nicknameMaxLength={nicknameMaxLength}
        messageMaxLength={messageMaxLength}
      />
    </main>
  );
}
