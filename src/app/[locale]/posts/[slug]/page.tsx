import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { renderMarkdown } from "@/lib";
import { messages, type Locale } from "@/messages";
import {
  listPublicComments,
  messageMaxLength,
  nicknameMaxLength,
} from "@/server/comments";
import { DomainError } from "@/server/errors";
import { getPublishedPost, type PublishedTranslation } from "@/server/posts";
import { localeParam } from "@/app/[locale]/locale-param";
import { SwitchTo } from "@/app/[locale]/public-frame";
import { tagHref } from "@/app/[locale]/tag-href";
import { Card, CommentForm, CommentList, PostMeta, Prose, TagList } from "@/ui";
import { submitCommentAction } from "./actions";
import styles from "./post.module.css";

type Params = Promise<{ locale: string; slug: string }>;

// Drafts, trashed, and unknown posts are not found. Rendered on every request
// so that a saved change shows at once.
const loadPost = cache(async (locale: string, slug: string) => {
  await connection();
  return getPublishedPost(localeParam(locale), slug).catch(notFoundIfMissing);
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
        backLabel={messages[post.language].allPosts}
        meta={
          <>
            <PostMeta publishedAt={post.publishedAt} language={post.language} />
            <TagList
              tags={post.tags}
              hrefFor={tagHref(post.language)}
              locale={post.language}
            />
            {post.translation && (
              <TranslationLink
                translation={post.translation}
                locale={post.language}
              />
            )}
          </>
        }
      >
        <Prose html={body} />
      </Card>
      <CommentList comments={comments} locale={post.language} />
      <CommentForm
        submit={submitCommentAction.bind(null, {
          language: post.language,
          slug: post.slug,
        })}
        nicknameMaxLength={nicknameMaxLength}
        messageMaxLength={messageMaxLength}
        locale={post.language}
      />
    </main>
  );
}

// The link to the post's published version in the other language, which the
// language switch leads to as well.
function TranslationLink({
  translation: { language, title, slug },
  locale,
}: {
  translation: PublishedTranslation;
  locale: Locale;
}) {
  const href = `/${language}/posts/${slug}`;
  return (
    <p className={styles.translation}>
      {messages[locale].translationIn[language]}
      <Link href={href} lang={language} hrefLang={language}>
        {title}
      </Link>
      <SwitchTo language={language} href={href} />
    </p>
  );
}
