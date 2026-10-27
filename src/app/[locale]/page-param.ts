import { z } from "zod";

// The ?page= of a paged public list: a positive whole number without leading
// zeros, or absent for the first page.
export const pageParam = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .optional();
