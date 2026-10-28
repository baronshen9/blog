// The English text of the public interface. Its shape is the type every other
// language's messages must match (see ./index.ts).
export const en = {
  languageSwitch: "Language",
  search: {
    label: "Search posts",
    submit: "Search",
    title: "Search",
    enterWord: "Enter a word to search for.",
    containing: (query: string) => `Posts containing “${query}”`,
    noMatch: (query: string) => `No posts match “${query}”.`,
  },
  home: { title: "Posts", empty: "No posts yet." },
  allPosts: "All posts",
  // What a post page says right before the link to its version in a
  // language, including the space that separates them.
  translationIn: { zh: "Also in Chinese: ", en: "Also in English: " },
  tags: { label: "Tags", tagged: (tag: string) => `Posts tagged “${tag}”` },
  pager: {
    label: "Pages",
    newer: "Newer",
    older: "Older",
    current: (page: number, count: number) => `Page ${page} of ${count}`,
  },
  notFound: {
    title: "Not found",
    heading: "Page not found",
    body: "This page does not exist or is no longer published.",
  },
  comments: {
    list: (count: number) => `Comments (${count})`,
    title: "Leave a comment",
    note: "No account needed. Comments appear after the author approves them.",
    nickname: "Nickname",
    message: "Message",
    trap: "Leave this field empty",
    submit: "Send comment",
    sent: "Thank you! Your comment awaits moderation and appears once the author approves it.",
    invalidForm: "The form is invalid; reload the page.",
    // Why the comments service refused a comment (CommentRefusal).
    refusals: {
      automated: () => "This comment looks automated and was not sent.",
      nicknameMissing: () => "Enter a nickname.",
      nicknameTooLong: (limits: CommentLimits) =>
        `Keep the nickname within ${limits.nicknameMaxLength.toLocaleString("en")} characters.`,
      messageMissing: () => "Enter a message.",
      messageTooLong: (limits: CommentLimits) =>
        `Keep the message within ${limits.messageMaxLength.toLocaleString("en")} characters.`,
      closed: () => "This post accepts no comments.",
      rateLimited: (limits: CommentLimits) =>
        `You have sent too many comments for now; try again in ${limits.windowMinutes} minutes.`,
    },
  },
};

// The limits a comment refusal can name.
export type CommentLimits = {
  nicknameMaxLength: number;
  messageMaxLength: number;
  windowMinutes: number;
};
