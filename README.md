# DB Intelligence NestJS module

`DbIntelligenceModule` is a self-contained NestJS module that exposes endpoints
for making a live MySQL database understandable to LLMs and turning
natural-language questions into safe, read-only SQL.

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
`openai` config from `DbIntelligenceModule.forRoot()` (`OPENAI_API_KEY`, `OPENAI_MODEL`), exposes `model`, and runs chat
completions via `createChatCompletion()` / `parseChatCompletion()` with the centrally configured model and
`DbIntelligenceModule.forRoot({ llm })` tuning. Features never call `new OpenAI(...)`
themselves.

### schema-intelligence

`SchemaIntelligenceService` builds a `DatabaseSchema` from `INFORMATION_SCHEMA` and
exposes guarded read-only query execution.

See **[docs/services/schema-intelligence.md](docs/services/schema-intelligence.md)** for the
snapshot shape, `category` / `select_risk` / `max_length`, and LLM compaction behavior.

## text-to-sql

See [docs/features/text-to-sql.md](docs/features/text-to-sql.md) for the full flow. In short: question + schema → LLM (structured
JSON output) → validate → `applyRowLimit` → `executeReadOnlyQuery` → rows.

## Documentation conventions

| What | Where |
| --- | --- |
| Module overview | [docs/README.md](docs/README.md) |
| Internal service | `docs/services/<name>.md` (e.g. [schema-intelligence](docs/services/schema-intelligence.md)) |
| HTTP feature | `docs/features/<name>.md` |

When adding or changing domain types, enums, or classifiers:

1. **Update the matching doc** — export tables, field semantics, `DATA_TYPE` mappings, examples.
2. **Add or refresh a file-level JSDoc header** on `types/*.ts` (and non-obvious `helpers/`): purpose, key constraints, then a link line, e.g. `Field-level detail: docs/services/schema-intelligence.md`.
3. **Keep headers short** — no duplicate tables; the doc is canonical for detail.

Contributor and agent conventions: [AGENTS.md](AGENTS.md) (section «Documentation and file headers»).

## Install

```bash
npm install @kir-ushakov/sf-db-intelligence
```

The package exports the Nest module plus the public HTTP contract types:
`DbIntelligenceModule`, `DbIntelligenceConfigInput`, `TextToSqlRequestDto`, and
`TextToSqlResult`.

## Configuration

Import the module with optional overrides:

```typescript
import { DbIntelligenceModule } from '@kir-ushakov/sf-db-intelligence';

@Module({
  imports: [
    DbIntelligenceModule.forRoot({
      llm: {
        timeoutMs: 60_000,
        maxRetries: 2,
        sqlMaxTokens: 1_024,
        sqlRowDefault: 200,
        sqlRowMax: 2_000,
        sqlTemperature: 0,
        schemaMaxChars: 120_000,
      },
    }),
  ],
})
export class AppModule {}
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
| `PORT` | HTTP listen port (host app) | `3001` |
| `BACKEND_PORT` | Fallback HTTP listen port for standalone only | — |

Runtime row limits are configured via `forRoot({ llm })`: `sqlRowDefault`
(`200`) is injected when the generated SQL has no outer `LIMIT`, and
`sqlRowMax` (`2_000`) clamps overly large explicit limits.

## Standalone run (local testing)

The npm package stays a library (`files: ["dist"]` excludes `standalone/`). For
manual testing without a host app, use the thin bootstrap under `standalone/`:

```bash
cp .env.example .env   # set OPENAI_API_KEY and MYSQL_* 
npm install
npm run start:dev      # ts-node, hot from source
```

Compiled run:

```bash
npm run build:standalone
npm start              # node dist/standalone/main.js
```

Then call the endpoint:

```bash
curl -X POST http://localhost:3001/text-to-sql \
  -H "Content-Type: application/json" \
  -d '{"question":"show me paid orders"}'
```

## Docker

The image runs the dev-only standalone server (`POST /text-to-sql`). MySQL stays
outside the container — set `MYSQL_*` in `.env` to your existing database. From
inside Docker, use `MYSQL_HOST=host.docker.internal` to reach MySQL on the host
(compose adds `extra_hosts` for Linux; Docker Desktop on Windows/macOS already
resolves it).

```bash
cp .env.example .env   # OPENAI_API_KEY + MYSQL_* pointing at your DB
npm run docker:up
```

Or build and run manually:

```bash
npm run docker:build
docker run --rm -p 3001:3001 --env-file .env sf-db-intelligence
```

## Testing

Unit tests live next to each file (`*.spec.ts`). Run them with `npm test`.
`LlmService` and `SchemaIntelligenceService` are mocked in feature specs (only
`llm.service.spec.ts` mocks the `openai` SDK directly); tests never touch a real
database or the OpenAI API.
