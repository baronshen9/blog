import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { listPublishedPosts } from "@/server/posts";
import { PageTitle, Pager, PostCard } from "@/ui";

export const metadata: Metadata = { title: "Posts" };

const pageParam = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .optional();

// The home page of a language: published posts, newest first, one page per
// ?page=. Reading the search parameters renders it on every request.
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const page = pageParam.safeParse((await searchParams).page);
  if (!page.success) notFound();
  const {
    posts,
    page: current,
    pageCount,
  } = await listPublishedPosts(page.data ?? 1).catch((error: unknown) => {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  return (
    <main>
      <PageTitle>Posts</PageTitle>
      {posts.length === 0 && <p>No posts yet.</p>}
      {posts.map(({ language, slug, ...post }) => (
        <PostCard
          key={`${language}/${slug}`}
          href={`/${language}/posts/${slug}`}
          language={language}
          {...post}
        />
      ))}
      {pageCount > 1 && (
        <Pager
          page={current}
          pageCount={pageCount}
          hrefFor={(n) => (n === 1 ? `/${locale}` : `/${locale}?page=${n}`)}
        />
      )}
    </main>
  );
}
