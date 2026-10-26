import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { renderMarkdown } from "@/lib";
import { DomainError } from "@/server/errors";
import { getPublishedPost, languages } from "@/server/posts";
import { Card, PostMeta, Prose } from "@/ui";

type Params = Promise<{ locale: string; slug: string }>;

// Drafts, trashed, and unknown posts are not found. Rendered on every request
// so that a saved change shows at once.
const loadPost = cache(async (locale: string, slug: string) => {
  await connection();
  const language = z.enum(languages).safeParse(locale);
  if (!language.success) notFound();
  return getPublishedPost(language.data, slug).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
});

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
  const body = await renderMarkdown(post.bodyMarkdown);
  return (
    <main>
      <Card
        title={post.title}
        backHref={`/${post.language}`}
        backLabel="All posts"
        meta={
          <PostMeta publishedAt={post.publishedAt} language={post.language} />
        }
      >
        <Prose html={body} />
      </Card>
    </main>
  );
}
