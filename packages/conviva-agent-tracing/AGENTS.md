# AGENTS.md — `@convivainc/agent-tracing`

Guidance for AI coding agents working on this package, or integrating it into
an application. Human docs: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md).

## What this package is

The Conviva agent tracing SDK (L3 in [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md)):
a thin wrapper over OpenLLMetry (`@traceloop/node-server-sdk`). `init()`
configures OpenLLMetry so that:

- everything OpenLLMetry auto-instruments is instrumented;
- `@convivainc/agent-traces-connector`'s `BaggageSpanProcessor` copies `c3.*`
  baggage onto every span;
- `@convivainc/otlp-exporter`'s processors stamp `cvx.conversation_id` and
  `cnv.project_id`;
- traces — and only traces — go to `https://<customerKey>.agw.conviva.com/v1/traces`.

Python twin: [`packages/python/conviva-agent-tracing`](../../python/conviva-agent-tracing).

## Layout

```
src/index.ts       init / forceFlush / shutdown / getConfig, and every re-export
test/init.test.ts  the initialize() call shape, against a mocked OpenLLMetry
test/boundaries.test.ts  layering assertions
```

## Commands

Run from `sdks/`. Build the dependencies first — this package resolves them
through their `dist/`:

```bash
pnpm install
pnpm --filter "./packages/js/*" build
pnpm --filter @convivainc/agent-tracing typecheck
pnpm --filter @convivainc/agent-tracing test
```

## Rules that must hold

1. **Processor order is load-bearing.** OpenLLMetry runs its own processor
   first, which writes association properties; the single `processor` it
   accepts runs after. Inside that composite the order is: baggage connector →
   Conviva processors → caller `spanProcessors`. Do not reorder.
2. **Traces only.** `disableNonTraceSignals()` defaults `OTEL_METRICS_EXPORTER`
   and `OTEL_LOGS_EXPORTER` to `none`. Do not add metric or log export.
3. **Validate before global state.** `resolveConfig()` runs before any env
   mutation or `initialize()` call, so bad config is a clean throw.
4. **Conviva owns the destination.** `baseUrl`, `exporter`, `processor` and
   `gcpProjectId` are removed from the passthrough type; keep it that way.
   Conviva-owned option keys must never leak into `initialize()` — there is a
   test for that; extend it when adding an option.
5. **Trace content is resolved once and applied twice:** to the `traceContent`
   option and to `TRACELOOP_TRACE_CONTENT`, because OpenLLMetry's manual and
   automatic paths read different sources.
6. **Re-export, don't wrap.** OpenLLMetry's manual API and the connector are
   re-exported unchanged so apps depend on this package alone. When adding a
   re-export, add it to the `vi.mock` in `test/init.test.ts`.
7. **Only OpenLLMetry as vendor.** No Langfuse or LangSmith dependency or
   re-export (`test/boundaries.test.ts`).
8. **CommonJS stays.** OpenLLMetry patches through the CJS loader.
9. **Parity with Python.** Same behaviour, `camelCase` here.

## Dependencies

`@convivainc/otlp-exporter` and `@convivainc/agent-traces-connector` as
`workspace:^` (rewritten to a range on publish); `@traceloop/node-server-sdk`;
`@opentelemetry/sdk-trace-base ^2.11.0`; peer `@opentelemetry/api ^1.9.0`.

## Releasing

Lockstep from `sdks/VERSION`: `node scripts/set-version.mjs <version>`, then
`node scripts/check-version.mjs`. Publish the exporter and connector before
this package.

## Integrating it into an app

- Call `init()` in a module loaded **before** any LLM or framework library.
- Wrap each user turn in `withAssociationProperties({ session_id }, …)` plus a
  `withWorkflow`, or rely on the client's `c3.conv_id` baggage.
- Make sure inbound `baggage` headers are extracted into context (HTTP
  instrumentation or `propagation.extract`).
- Call `forceFlush()` before a short-lived process exits.
- Do not create a second `NodeSDK` or tracer provider alongside it.
