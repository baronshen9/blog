import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { pageParam } from "@/app/[locale]/page-param";
import { tagHref } from "@/app/[locale]/tag-href";
import { DomainError } from "@/server/errors";
import { searchPublishedPosts } from "@/server/posts";
import { PageTitle, Pager, PostCard } from "@/ui";

export const metadata: Metadata = { title: "Search" };

// A missing or repeated ?q= counts as an empty search.
const queryParam = z.string().catch("");

// Published posts whose title or body contains ?q=, newest first, one page
// per ?page=. An empty search and a search without matches say so.
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  const query = queryParam.parse(search.q);
  const page = pageParam.safeParse(search.page);
  if (!page.success) notFound();
  const result = await searchPublishedPosts(query, page.data ?? 1).catch(
    (error: unknown) => {
      if (!(error instanceof DomainError)) throw error;
      if (error.code === "NOT_FOUND") notFound();
      if (error.code === "VALIDATION") return error.message;
      throw error;
    },
  );
  if (typeof result === "string") {
    return (
      <main>
        <PageTitle>Search</PageTitle>
        <p>{result}</p>
      </main>
    );
  }
  const { posts, page: current, pageCount } = result;
  return (
    <main>
      <PageTitle description={`Posts containing “${query.trim()}”`}>
        Search
      </PageTitle>
      {posts.length === 0 && <p>No posts match “{query.trim()}”.</p>}
      {posts.map(({ language, slug, ...post }) => (
        <PostCard
          key={`${language}/${slug}`}
          href={`/${language}/posts/${slug}`}
          language={language}
          tagHref={tagHref(locale)}
          {...post}
        />
      ))}
      {pageCount > 1 && (
        <Pager
          page={current}
          pageCount={pageCount}
          hrefFor={(n) =>
            `/${locale}/search?${new URLSearchParams({
              q: query.trim(),
              ...(n > 1 && { page: String(n) }),
            })}`
          }
        />
      )}
    </main>
  );
}
