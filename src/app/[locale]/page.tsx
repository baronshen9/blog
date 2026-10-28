import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { messages } from "@/messages";
import { DomainError } from "@/server/errors";
import { listPublishedPosts } from "@/server/posts";
import { localeParam } from "./locale-param";
import { PageTitle, Pager, PostCard } from "@/ui";
import { pageParam } from "./page-param";
import { tagHref } from "./tag-href";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const locale = localeParam((await params).locale);
  return { title: messages[locale].home.title };
}

// The home page of a language: its list of published posts, newest first, one
// page per ?page=. Reading the search parameters renders it on every request.
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = localeParam((await params).locale);
  const text = messages[locale].home;
  const page = pageParam.safeParse((await searchParams).page);
  if (!page.success) notFound();
  const {
    posts,
    page: current,
    pageCount,
  } = await listPublishedPosts(locale, page.data ?? 1).catch(
    (error: unknown) => {
      if (error instanceof DomainError && error.code === "NOT_FOUND") {
        notFound();
      }
      throw error;
    },
  );
  return (
    <main>
      <PageTitle>{text.title}</PageTitle>
      {posts.length === 0 && <p>{text.empty}</p>}
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
          hrefFor={(n) => (n === 1 ? `/${locale}` : `/${locale}?page=${n}`)}
          locale={locale}
        />
      )}
    </main>
  );
}
