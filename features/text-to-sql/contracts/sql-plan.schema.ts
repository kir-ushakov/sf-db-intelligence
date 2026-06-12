/**
 * Zod contract for the text-to-sql LLM structured output ({ sql, params }).
 * Fed to `zodResponseFormat()` so the OpenAI SDK derives JSON Schema and
 * validates `message.parsed` from a single source of truth.
 *
 * Behaviour and testing: docs/features/text-to-sql.md
 */
import { z } from 'zod';

/** Bound values for `?` placeholders (MySQL driver accepts these JSON types). */
export const sqlParamSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const sqlPlanSchema = z.object({
  sql: z.string(),
  params: z.array(sqlParamSchema),
});

export type SqlPlan = z.infer<typeof sqlPlanSchema>;
