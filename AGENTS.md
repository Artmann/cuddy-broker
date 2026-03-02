# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated.
Always retrieve current documentation before any Workers, KV, R2, D1, Durable
Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page.
eg. `/workers/platform/limits`

## Commands

| Command              | Purpose                     |
| -------------------- | --------------------------- |
| `bun run dev`        | Local development           |
| `bun run deploy`     | Deploy to Cloudflare        |
| `bun run test`       | Run tests (vitest)          |
| `bun run test:watch` | Run tests in watch mode     |
| `bun run typecheck`  | Type-check (`tsc --noEmit`) |
| `npx wrangler types` | Generate TypeScript types   |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Testing

Tests use **Vitest** with `@cloudflare/vitest-pool-workers`. Tests run inside
the real Workers V8 runtime with real Durable Object bindings — no mocking.

- Config: `vitest.config.ts` (uses `defineWorkersConfig`)
- Integration tests use `SELF.fetch()` from `cloudflare:test`
- `isolatedStorage: true` gives each test fresh Durable Object storage
- `singleWorker: true` runs all tests in one runtime
- `onConsoleLog() { return false }` suppresses error handler log noise

### Test file layout

| File                        | Covers                               |
| --------------------------- | ------------------------------------ |
| `src/index.test.ts`         | Root endpoints (`/`, `/health`, 404) |
| `src/broker/routes.test.ts` | Job queue CRUD endpoints             |

### Type safety in tests

`response.json()` returns `unknown`. Always cast with `as` to a typed interface:

```ts
const body = (await response.json()) as JobResponse
```

### Version constraints

- `vitest` must be `~3.2.0` (`@cloudflare/vitest-pool-workers` does not support
  Vitest 4)
- `package.json` has `overrides` pinning `@vitest/runner` and `@vitest/snapshot`
  to `3.2.4` — bun may otherwise hoist incompatible v4 versions from transitive
  dependencies

### tsconfig notes

- `target` is `es2022` (not `es2024`) — esbuild doesn't recognize `es2024` and
  emits warnings during vitest runs. Since `noEmit: true`, target only affects
  type-checking; `lib: ["es2024"]` controls available APIs.
- `moduleResolution` is `bundler` — required for resolving
  `@cloudflare/vitest-pool-workers/config` subpath exports.
- `types` array includes `@cloudflare/vitest-pool-workers` for `cloudflare:test`
  module types.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from
  `/workers/platform/limits/`
- **All errors**:
  https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from: `/kv/` · `/r2/` · `/d1/` ·
`/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`
