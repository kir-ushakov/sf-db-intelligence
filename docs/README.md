# DB Intelligence module

`DbIntelligenceModule` exposes endpoints that
make a live MySQL database understandable to LLMs and turn natural-language questions into
safe, read-only SQL.

## Features

| Feature | Folder | Responsibility | HTTP |
| --- | --- | --- | --- |
| Text-to-SQL | `features/text-to-sql/` | Turn an NL question into ONE read-only query, execute it, return rows | `POST /text-to-sql` |

`text-to-sql` depends on internal services under `services/`; never the reverse.

## services (internal)

Shared module services have no HTTP surface. They are registered in `DbIntelligenceModule` and exported for injection by features.

| Service | Folder | Responsibility |
| --- | --- | --- |
| LLM | `services/llm/` | OpenAI client wrapper (`LlmService`) |
| Schema intelligence | `services/schema-intelligence/` | Schema snapshot from `INFORMATION_SCHEMA`; guarded read-only query execution |

### llm

`LlmService` is the single owner of the OpenAI client. It receives validated
`openai` config from `ConfigModule` (`OPENAI_API_KEY`, `OPENAI_MODEL`), exposes `model`, and runs chat
completions via `createChatCompletion()` / `parseChatCompletion()` with the centrally configured model and
`DbIntelligenceModule.forRoot({ llm })` tuning. Features never call `new OpenAI(...)`
themselves.

### schema-intelligence

`SchemaIntelligenceService` builds a `DatabaseSchema` from `INFORMATION_SCHEMA` and
exposes guarded read-only query execution.

See **[services/schema-intelligence.md](services/schema-intelligence.md)** for the
snapshot shape, `category` / `select_risk` / `max_length`, and LLM compaction behavior.

## text-to-sql

See `features/text-to-sql.md` for the full flow. In short: question + schema → LLM (structured
JSON output) → validate → `applyRowLimit` → `executeReadOnlyQuery` → rows.

## Documentation conventions

| What | Where |
| --- | --- |
| Module overview | `docs/README.md` (this file) |
| Internal service | `docs/services/<name>.md` (e.g. [schema-intelligence](services/schema-intelligence.md)) |
| HTTP feature | `docs/features/<name>.md` |

When adding or changing domain types, enums, or classifiers:

1. **Update the matching doc** — export tables, field semantics, `DATA_TYPE` mappings, examples.
2. **Add or refresh a file-level JSDoc header** on `types/*.ts` (and non-obvious `helpers/`): purpose, key constraints, then a link line, e.g. `Field-level detail: docs/services/schema-intelligence.md`.
3. **Keep headers short** — no duplicate tables; the doc is canonical for detail.

Contributor and agent conventions: [AGENTS.md](../AGENTS.md) (section «Documentation and file headers»).

## Configuration

Import the module with optional overrides:

```typescript
DbIntelligenceModule.forRoot({
  llm: {
    timeoutMs: 60_000,
    maxRetries: 2,
    sqlMaxTokens: 1_024,
    sqlTemperature: 0,
    schemaMaxChars: 120_000,
  },
});
```

Omitted `llm` fields fall back to `DEFAULT_DB_INTELLIGENCE_CONFIG` in `db-intelligence.config.ts`.

The module is self-contained: `forRoot` resolves `OPENAI_*` and `MYSQL_*` from
`process.env` and merges any explicit overrides, e.g. `forRoot({ openai: { apiKey },
mysql: { host } })`. It does not depend on the host app validating env. A missing/empty
`OPENAI_API_KEY` with no `forRoot({ openai })` override throws at module init.

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | Enables text-to-sql | — (required) |
| `OPENAI_MODEL` | Chat model | `gpt-4o-mini` |
| `MYSQL_HOST` / `MYSQL_PORT` | DB connection | `localhost` / `3306` |
| `MYSQL_USER` / `MYSQL_PASSWORD` | DB credentials | `root` / `root` |
| `MYSQL_DATABASE` | Target schema | `classicmodels` |
| `MYSQL_CONNECTION_LIMIT` | Pool size | `10` |
| `MYSQL_WAIT_FOR_CONNECTIONS` | Queue when pool is full | `true` |
| `MYSQL_QUEUE_LIMIT` | Max queued connection requests (`0` = unlimited) | `0` |
| `MYSQL_TIMEZONE` | Session timezone for date values | `Z` (UTC) |
| `PORT` | HTTP listen port | `3001` |

## Testing

Unit tests live next to each file (`*.spec.ts`). Run them with `npx jest src/db-intelligence`.
`LlmService` and `SchemaIntelligenceService` are mocked in feature specs (only
`llm.service.spec.ts` mocks the `openai` SDK directly); tests never touch a real
database or the OpenAI API.
