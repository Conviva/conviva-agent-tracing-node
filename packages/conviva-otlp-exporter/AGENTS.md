# AGENTS.md — `@convivainc/otlp-exporter`

Guidance for AI coding agents working on this package, or integrating it into
an application. Human docs: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md).

## What this package is

The Conviva **transport layer** (L2 in [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)):
config resolution, the OTLP http/protobuf **trace** exporter, and the span
processors that stamp `cnv.project_id` and `cvx.conversation_id`.
`@convivainc/agent-tracing` depends on it; it can also ship and be used alone.

Python twin: [`packages/python/conviva-otlp-exporter`](../../python/conviva-otlp-exporter).

## Layout

```
src/
  index.ts                  public entry point — the only one
  config.ts                 constants + resolveConfig()
  errors.ts                 ConvivaTracingError
  exporters/trace.ts        createTraceExporter()
  processors/
    conversation.ts         ConversationIdSpanProcessor
    projectId.ts            ProjectIdSpanProcessor
    attributes.ts           AttributeSpanProcessor
    composite.ts            CompositeSpanProcessor
    index.ts                createConvivaSpanProcessors()
test/                       vitest; contract.test.ts reads ../../../contract/config-contract.json
```

## Commands

Run from `sdks/`:

```bash
pnpm install
pnpm --filter @convivainc/otlp-exporter build
pnpm --filter @convivainc/otlp-exporter typecheck
pnpm --filter @convivainc/otlp-exporter test
```

## Rules that must hold

1. **No vendor SDK.** No `@traceloop/*`, `@langfuse/*` or similar in any
   dependency field or import. `test/boundaries.test.ts` enforces it.
2. **Traces only.** Do not add metric or log exporters, or their
   `@opentelemetry/exporter-*` packages. The gateway serves `/v1/traces` only.
3. **Wire constants live in the contract.** Env names, header, attribute names,
   domain and paths are authored in `sdks/contract/config-contract.json`. Change
   the contract first, then this package, the Python twin and
   `packages/coding-agents` together.
4. **Keep existing attribute keys.** `cvx.conversation_id`, `cnv.project_id` and
   the default source and baggage keys are what the gateway and existing
   customers read. Add to the lists; do not rename or reorder without a reason.
5. **Processors mutate in `onStart` only**, never throw, and never overwrite a
   value the application already set.
6. **Conversation ids are extracted, never generated.**
7. **Parity with Python.** Same behaviour, same defaults, `camelCase` here and
   `snake_case` there. A change in one needs the matching change and test in
   the other.
8. **Validate before global state.** `resolveConfig()` throws
   `ConvivaTracingError` on bad input; callers rely on that happening first.

## Dependencies

`@opentelemetry/sdk-trace-base` and `@opentelemetry/exporter-trace-otlp-proto`
at the versions the workspace already uses (`^2.11.0` / `^0.220.0`); peer
`@opentelemetry/api ^1.9.0`. Mixing SDK major versions in the workspace yields
`SpanProcessor` types that are not assignable to each other.

## Releasing

Versions move in lockstep from `sdks/VERSION`: run
`node scripts/set-version.mjs <version>`, then `node scripts/check-version.mjs`.
Never edit a version field by hand.

## Integrating it into an app

- Prefer `@convivainc/agent-tracing` when the app has no instrumentation yet.
- Call `resolveConfig()` once at startup; reuse the result.
- Register `createConvivaSpanProcessors(config)` on the **same provider** that
  owns the exporting processor.
- Never log or attach the customer key to spans; the hostname carries it.
