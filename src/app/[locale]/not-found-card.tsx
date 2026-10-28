import { messages, type Locale } from "@/messages";
import { Card } from "@/ui";
import { SwitchTo } from "./public-frame";

// The not-found page's content and title in `locale`, leading back to that
// language's home page, as the language switch does for every language: a
// not-found URL, such as an unknown tag, has no equivalent in another one.
export function NotFoundCard({ locale }: { locale: Locale }) {
  const text = messages[locale];
  return (
    <main>
      <title>{text.notFound.title}</title>
      <Card
        title={text.notFound.heading}
        backHref={`/${locale}`}
        backLabel={text.allPosts}
      >
        <p>{text.notFound.body}</p>
      </Card>
      {(Object.keys(messages) as Locale[]).map((language) => (
        <SwitchTo key={language} language={language} href={`/${language}`} />
      ))}
    </main>
  );
}
