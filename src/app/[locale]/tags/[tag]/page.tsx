import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { localeParam } from "@/app/[locale]/locale-param";
import { pageParam } from "@/app/[locale]/page-param";
import { tagHref } from "@/app/[locale]/tag-href";
import { messages } from "@/messages";
import { DomainError } from "@/server/errors";
import { listPublishedPostsByTag, type Language } from "@/server/posts";
import { PageTitle, Pager, PostCard } from "@/ui";

type Props = {
  params: Promise<{ locale: string; tag: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The page's posts in a language's list, loaded once for the title and the
// page. Next.js passes the tag segment percent-encoded, as non-Latin names
// arrive (it refuses a malformed encoding itself). A tag without published
// posts and a page past its last are not found.
const loadPage = cache(
  async (locale: Language, segment: string, pageText: unknown) => {
    const page = pageParam.safeParse(pageText);
    if (!page.success) notFound();
    const tag = decodeURIComponent(segment);
    return listPublishedPostsByTag(locale, tag, page.data ?? 1).catch(
      (error: unknown) => {
        if (error instanceof DomainError && error.code === "NOT_FOUND") {
          notFound();
        }
        throw error;
      },
    );
  },
);

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale, tag: segment } = await params;
  const { tag } = await loadPage(
    localeParam(locale),
    segment,
    (await searchParams).page,
  );
  return { title: `#${tag}` };
}

// The published posts with a tag in the language's list, newest first, one
// page per ?page=.
export default async function TagPage({ params, searchParams }: Props) {
  const { tag } = await params;
  const locale = localeParam((await params).locale);
  const {
    posts,
    tag: name,
    page,
    pageCount,
  } = await loadPage(locale, tag, (await searchParams).page);
  const href = tagHref(locale);
  return (
    <main>
      <PageTitle description={messages[locale].tags.tagged(name)}>
        #{name}
      </PageTitle>
      {posts.map(({ language, slug, ...post }) => (
        <PostCard
          key={`${language}/${slug}`}
          href={`/${language}/posts/${slug}`}
          language={language}
          tagHref={href}
          locale={locale}
          {...post}
        />
      ))}
      {pageCount > 1 && (
        <Pager
          page={page}
          pageCount={pageCount}
          hrefFor={(n) => (n === 1 ? href(name) : `${href(name)}?page=${n}`)}
          locale={locale}
        />
      )}
    </main>
  );
}
