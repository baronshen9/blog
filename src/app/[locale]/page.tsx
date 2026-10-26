import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DomainError } from "@/server/errors";
import { listPublishedPosts } from "@/server/posts";
import { LanguageLabel } from "@/ui";

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
  const pageHref = (n: number) =>
    n === 1 ? `/${locale}` : `/${locale}?page=${n}`;
  return (
    <main>
      <h1>Posts</h1>
      {posts.length === 0 && <p>No posts yet.</p>}
      {posts.map((post) => (
        <article key={`${post.language}/${post.slug}`}>
          <h2>
            <Link href={`/${post.language}/posts/${post.slug}`}>
              {post.title}
            </Link>
          </h2>
          <p>
            <time dateTime={post.publishedAt.toISOString()}>
              {post.publishedAt.toISOString().slice(0, 10)}
            </time>{" "}
            <LanguageLabel language={post.language} />
          </p>
          <p>{post.excerpt}</p>
        </article>
      ))}
      {pageCount > 1 && (
        <nav aria-label="Pages">
          {current > 1 && (
            <Link href={pageHref(current - 1)} rel="prev">
              Newer posts
            </Link>
          )}{" "}
          <span>
            Page {current} of {pageCount}
          </span>{" "}
          {current < pageCount && (
            <Link href={pageHref(current + 1)} rel="next">
              Older posts
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
