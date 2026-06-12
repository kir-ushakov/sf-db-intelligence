# Text-to-SQL feature

Turns a natural-language question into ONE read-only MySQL query, executes it against the
configured database, and returns the rows.

- **Endpoint:** `POST /text-to-sql`
- **Controller:** `TextToSqlController`
- **Service:** `TextToSqlService` (orchestration only; splits into `loadSchemaForPrompt` / `requestSqlPlan` / `extractSqlPlan`)
- **DTO:** `text-to-sql.dto.ts` (`TextToSqlRequestDto` — validated request body)
- **Types:** `text-to-sql.types.ts` (`SqlQuery`, `TextToSqlResult`)
- **Prompt:** `text-to-sql.prompt.ts` (`buildSqlSystemPrompt`, `buildSqlUserPrompt`)
- **Contract:** `contracts/sql-plan.schema.ts` (`sqlPlanSchema` — Zod structured-output schema)
- **Helpers:** `helpers/apply-row-limit.function.ts`, `helpers/find-outer-limit.function.ts` (pure, unit-tested)

## Request / response

Request body (`TextToSqlRequestDto`):

```
POST /text-to-sql
Content-Type: application/json

{ "question": "show me paid orders" }
```

`question` must be a non-empty string. Leading and trailing whitespace is trimmed before
validation. Invalid or missing input is rejected by the global `ValidationPipe` with `400` and
does not reach the service.

Response (`TextToSqlResult`):

```jsonc
{
  "question": "show me paid orders",
  "sql": "SELECT ... LIMIT 200",
  "params": ["Shipped"],
  "rows": [ /* result rows */ ],
  "rowLimit": 200,      // effective cap applied (default, explicit, or clamped to max)
  "truncated": false    // true when rows.length hit rowLimit → more may exist
}
```

## Flow

1. Global `ValidationPipe` validates and trims `question` from the JSON body; invalid input → 400.
2. Load the schema snapshot via `SchemaIntelligenceService.getDatabaseSchema()`.
3. Call OpenAI Chat Completions via `LlmService.parseChatCompletion()` with `zodResponseFormat(sqlPlanSchema, 'sql_plan')`, `temperature: 0`, and a bounded `max_tokens`. The SDK derives the JSON Schema from Zod and validates `message.parsed`. The schema snapshot is passed through `formatSchemaForLlm()` so oversized JSON is compacted before the prompt is sent. System rules: read-only, no semicolons, prefer explicit columns, avoid `risky` fields, treat `approx_row_count` as an estimate (not exact), honor an explicit row count (capped at `sqlRowMax`) else add `LIMIT sqlRowDefault`, use `?` placeholders.
4. Read the first choice and inspect it before trusting it:
   - `finish_reason === 'length'` → truncated → `BadGatewayException` (502).
   - missing `message.parsed` (refusal or schema mismatch) → `BadGatewayException` (502).
5. `applyRowLimit` bounds the result: only the **outermost** terminal `LIMIT` counts (inner subquery or UNION-branch limits are ignored). When no outer limit exists, appends `LIMIT sqlRowDefault` at the end (works for plain SELECT, WITH, and UNION). Keeps an explicit outer limit within `sqlRowMax`, or clamps a larger one down to `sqlRowMax`. Returns the effective `rowLimit`; the service sets `truncated` when `rows.length >= rowLimit`.
6. `SchemaIntelligenceService.executeReadOnlyQuery` runs the SQL behind the read-only guard.

## Trust boundary & error handling

The model output is **untrusted**. Validation is enforced by OpenAI Structured Outputs
(`sqlPlanSchema` via `zodResponseFormat`) and the SDK's `chat.completions.parse()` helper,
which populates `message.parsed` only when the response matches the schema. There is
intentionally **no** "extract JSON from surrounding text" heuristic — salvaging malformed
output hides real upstream problems.

Error classes follow the module convention:

| Situation | Exception | Status |
| --- | --- | --- |
| Missing, invalid, or whitespace-only `question` (`ValidationPipe`) | `BadRequestException` | 400 |
| Missing `OPENAI_API_KEY` at startup | Process exit (env validation) | — |
| Malformed / truncated / empty model output | `BadGatewayException` | 502 |
| Unknown failure (DB, network, …) | `InternalServerErrorException` | 500 |

Raw model output is never returned to the client; on parse failure a truncated snippet plus
`model`/`finish_reason` is logged at `warn` level for debugging.

## Safety

Every generated query is forced through `executeReadOnlyQuery`, which rejects anything that
is not a single `SELECT`/`WITH` or contains semicolons. Values are bound through `?`
placeholders rather than string-interpolated. The MySQL connection should use a user with
`SELECT`-only grants on the target schema.

## Notes / future work

- On truncation, surfacing a hint to raise `max_tokens` would help debugging cheap models.
