import { en, type CommentLimits } from "./en";
import { zh } from "./zh";

// The text of the public interface in each language, checked by the compiler
// to have every message. The admin is English only and does not use these.
// Client components import this module, so it holds text only: nothing here
// may import code that browsers should not download.
export type Messages = typeof en;
export type CommentRefusal = keyof Messages["comments"]["refusals"];
export type { CommentLimits };

export const messages = { zh, en } satisfies Record<string, Messages>;
export type Locale = keyof typeof messages;
