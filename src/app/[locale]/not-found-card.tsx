import { messages, type Locale } from "@/messages";
import { Card } from "@/ui";

// The not-found page's content and title in `locale`, leading back to that
// language's home page.
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
    </main>
  );
}
