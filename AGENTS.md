# db-intelligence — Agent guide

Guidance for contributors and agents in `backend/src/db-intelligence`.

**Folder layout (canonical):** `.cursor/rules/db-intelligence.mdc` — applied automatically when editing files in this module.

## What this module does

`DbIntelligenceModule` turns a live MySQL database into LLM-friendly artifacts:

- **schema-intelligence** (`services/schema-intelligence/`) — `INFORMATION_SCHEMA` snapshot and guarded read-only queries. Internal only.
- **text-to-sql** (`features/text-to-sql/`) — NL question → one read-only SQL query → rows.

See `docs/README.md` and `docs/features/text-to-sql.md`.

## Documentation

- Layout mirrors code: `docs/services/<service>.md`, `docs/features/<feature>.md`.
- Domain types and classifiers: document in the service/feature doc; add a compact **file-level JSDoc** on `types/*.ts` (purpose + constraints + last line `…: docs/services/….md`). See `types/schema.types.ts` and `types/field-category.enum.ts`.
- Do not duplicate long mappings in headers; keep tables in markdown.

Full rules: `.cursor/rules/db-intelligence.mdc` (section «Documentation and file headers»).

## Conventions

- **Pure helpers** live in `helpers/` (service or feature), not as class methods; colocate `*.spec.ts`.
- **Error semantics:**
  - Bad client input → `BadRequestException` (400).
  - Missing config at runtime → should not occur: `OPENAI_API_KEY` is validated at startup (`ConfigModule` + zod).
  - Malformed/truncated/empty LLM output → `BadGatewayException` (502). Never return raw model output to the client; log a truncated snippet + `finish_reason` server-side.
- Re-throw `HttpException` as-is; wrap only unknown errors.

## text-to-sql

- Chat Completions with `response_format: json_schema`; `parseAiJson` + `toSqlQuery` validate only — no JSON salvage heuristics.
- SQL goes through `applyRowLimit` and `SchemaIntelligenceService.executeReadOnlyQuery`.
- HTTP: `POST /text-to-sql`.

## Environment

Self-contained: `DbIntelligenceModule.forRoot` resolves config from `process.env` merged with overrides — no dependency on the host app's config. A missing/empty `OPENAI_API_KEY` with no `forRoot({ openai })` override throws at module init.

- `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default `gpt-4o-mini`); both also settable via `forRoot({ openai })`. LLM tuning via `forRoot({ llm })`.
- `MYSQL_*` for the target database (defaults in `mysql.config.ts`; pool tuning via env or `forRoot({ mysql })`).
- `PORT` (default `3001`) is the host app's concern, not the module's.

## Standalone run

`standalone/` is a dev-only Nest host (not published). `npm run start:dev` loads
`.env` and listens on `PORT` (default `30001`). Library build (`npm run build`)
excludes `standalone/`; use `npm run build:standalone` before `npm start`.

## Testing

- `npm test`
- Mock `LlmService` and `SchemaIntelligenceService` in feature specs; only `llm.service.spec.ts` mocks `openai` directly.
