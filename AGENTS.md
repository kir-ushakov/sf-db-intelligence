# Agent guide

Guidance for contributors and agents in this repository.

## Module layout

Each NestJS module in this repo is self-contained: HTTP **features**, internal **services** (no controllers on services), and matching **docs**.

| Path | Role |
| --- | --- |
| `features/` | User-facing HTTP: `*.controller.ts`, feature `*.service.ts`, feature-local `*.types.ts`, prompts |
| `services/` | Internal Nest providers consumed by features (and each other only when dependency is clear) |
| `docs/` | Module and per-feature documentation |
| `<name>.module.ts`, `<name>.config.ts` | Module wiring and config at package root |

**Import direction:** `features/` → `services/` only. Services must not import from `features/`.

### Inside `services/<name>/`

| Subfolder / file | Contents |
| --- | --- |
| `<name>.service.ts` | Injectable at service root |
| `types/` | Shared interfaces, enums, type aliases for this service (no runtime logic) |
| `helpers/` | Pure functions + colocated `*.spec.ts` |

**Naming in `helpers/`:** files that export exactly one function → `<kebab-name>.function.ts` with colocated `*.function.spec.ts`. Colocated types/interfaces for that function stay in the same file. Files that also export constants, multiple functions, or shared types keep plain `*.ts`.

**Naming in `types/`:** interfaces and type aliases → `*.types.ts`; enums → `*.enum.ts`. Do not add bare `*.ts` type files without the suffix.

Do not add `*.controller.ts` under `services/`.

Domain types belong in the owning service's `types/` or `helpers/`; features import them as needed.

### Inside `features/<name>/`

| Location | Contents |
| --- | --- |
| Feature root | `*.controller.ts`, `*.service.ts`, `*.types.ts`, `*.prompt.ts` |
| `helpers/` | Pure functions for this feature only (if needed) |

Feature-specific DTOs and result types stay in the feature root, not in `services/`.

### What not to add

- Top-level `controllers/`, `utils/`, or duplicate `types/` at module root.
- HTTP routes for internal services unless explicitly requested.

## db-intelligence (this package)

`DbIntelligenceModule` turns a live MySQL database into LLM-friendly artifacts:

- **schema-intelligence** (`services/schema-intelligence/`) — `INFORMATION_SCHEMA` snapshot and guarded read-only queries. Internal only.
- **text-to-sql** (`features/text-to-sql/`) — NL question → one read-only SQL query → rows.

See `docs/README.md` and `docs/features/text-to-sql.md`.

**Shared providers (this package only):**

- **LLM:** only `services/llm/llm.service.ts` constructs the OpenAI client.
- **SQL execution:** only `SchemaIntelligenceService.executeReadOnlyQuery` runs SQL (read-only guard).

**Layout examples:**

```
services/schema-intelligence/
  schema-intelligence.service.ts
  types/          # schema.types.ts, raw-rows.types.ts, field-category.enum.ts
  helpers/        # classify-*.function.ts, schema-for-llm.ts, …

features/text-to-sql/
  text-to-sql.controller.ts
  text-to-sql.service.ts
  text-to-sql.types.ts
  helpers/        # apply-row-limit.function.ts, …
```

## Documentation

**Docs mirror code layout:** `docs/features/<feature>.md`, `docs/services/<service>.md`, overview in `docs/README.md`. When you add or change domain types, classifiers, or non-obvious behavior, update the matching doc (tables, mappings, examples)—not only code.

- Domain types and classifiers: document in the service/feature doc; add a compact **file-level JSDoc** on `types/*.ts` (purpose + constraints + last line `…: docs/services/….md`).
- Do not duplicate long mappings in headers; keep tables in markdown.

### File-level JSDoc headers

Always the **first thing in the file, above imports** (never between imports and code):

- `<name>.module.ts` at package root — required. What the Nest module wires (`forRoot` providers, controllers, layering rule). Not a duplicate of `docs/README.md` tables.
- `types/*.types.ts`, `types/*.enum.ts` — required when the file exports snapshot/domain types consumers rely on.
- `helpers/*.function.ts` with non-trivial domain rules — required. Skip only when a single trivial export needs no extra context.
- `*.service.ts` — required. Describes the file's orchestration role, not the `@Injectable()` class. Do not add a separate class-level JSDoc unless it documents something the file header does not.

Do not also put a second file-level block above an individual export; one header per file.

Header content (keep compact):

1. What the file owns and key design constraints (why, not a line-by-line map). For services, state the orchestration flow and any non-obvious error semantics (e.g. which failures map to 502 vs 500).
2. Last line: relative path to the canonical doc, e.g. `Behaviour and testing: docs/features/text-to-sql.md`.

Do **not** duplicate long tables or domain mappings in the header—that belongs in the doc. The doc should list the same types/exports and link back to source paths.

**Private method JSDoc** — selective, not blanket. Document a private method only when its name + signature do not convey intent, or when it has non-obvious behaviour (error mapping, domain constraints, why-not-X). Leave self-explanatory one-liners and `assert*` guards bare. A non-obvious detail local to a few lines is better as an inline comment than a method header.

## Comments

Code should mostly explain itself through names, types, and structure. Add a comment only when the reader cannot infer the intent from the code alone: non-obvious business rules, surprising behaviour, security/correctness semantics, or public API contracts where types alone are insufficient.

Do not restate what the code already says, scatter refactoring history in the body, or duplicate folder layout already documented here or in `docs/`. Prefer clearer naming over explanatory comments.

## Conventions

- **Pure helpers** live in `helpers/` (service or feature), not as class methods; colocate `*.spec.ts`.
- **Error semantics:**
  - Bad client input → `BadRequestException` (400).
  - Missing config at runtime → should not occur: required keys are validated at startup (`ConfigModule` + zod).
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
