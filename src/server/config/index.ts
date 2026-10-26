import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  OWNER_USERNAME: z.string().min(1),
  OWNER_PASSWORD: z.string().min(1),
  SITE_DEFAULT_LANGUAGE: z.enum(["zh", "en"]),
});

export type Config = z.infer<typeof schema>;

let config: Config | undefined;

// Parsed on first use rather than at import, so `next build` needs no runtime
// configuration.
export function getConfig(): Config {
  config ??= schema.parse(process.env);
  return config;
}
