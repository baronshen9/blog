import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { localeParam } from "@/app/[locale]/locale-param";
import { pageParam } from "@/app/[locale]/page-param";
import { tagHref } from "@/app/[locale]/tag-href";
import { messages } from "@/messages";
import { DomainError } from "@/server/errors";
import { searchPublishedPosts } from "@/server/posts";
import { PageTitle, Pager, PostCard } from "@/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = localeParam((await params).locale);
  return { title: messages[locale].search.title };
}

// A missing or repeated ?q= counts as an empty search.
const queryParam = z.string().catch("");

// The published posts in the language's list whose title or body contains
// ?q=, newest first, one page per ?page=. An empty search, the service's only
// refusal, and a search without matches say so.
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = localeParam((await params).locale);
  const text = messages[locale].search;
  const search = await searchParams;
  const query = queryParam.parse(search.q);
  const page = pageParam.safeParse(search.page);
  if (!page.success) notFound();
  const result = await searchPublishedPosts(
    locale,
    query,
    page.data ?? 1,
  ).catch((error: unknown) => {
    if (!(error instanceof DomainError)) throw error;
    if (error.code === "NOT_FOUND") notFound();
    if (error.code === "VALIDATION") return text.enterWord;
    throw error;
  });
  if (typeof result === "string") {
    return (
      <main>
        <PageTitle>{text.title}</PageTitle>
        <p>{result}</p>
      </main>
    );
  }
  const { posts, page: current, pageCount } = result;
  return (
    <main>
      <PageTitle description={text.containing(query.trim())}>
        {text.title}
      </PageTitle>
      {posts.length === 0 && <p>{text.noMatch(query.trim())}</p>}
      {posts.map(({ language, slug, ...post }) => (
        <PostCard
          key={`${language}/${slug}`}
          href={`/${language}/posts/${slug}`}
          language={language}
          tagHref={tagHref(locale)}
          locale={locale}
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
          locale={locale}
        />
      )}
    </main>
  );
}
