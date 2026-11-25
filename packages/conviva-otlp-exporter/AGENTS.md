# AGENTS.md — `@convivainc/otlp-exporter`

Sends OpenTelemetry **traces** to the Conviva gateway. It resolves the config,
builds the OTLP exporter (with the optional mask hook), and provides the span
processors that write `cnv.project_id` and `cvx.conversation_id`.
`@convivainc/agent-tracing` is built on it; it also works on its own.

Python twin: [`../../python/conviva-otlp-exporter`](../../python/conviva-otlp-exporter).
Human docs: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md).

## Commands

Run from `sdks/`:

```bash
pnpm install
pnpm --filter @convivainc/otlp-exporter build
pnpm --filter @convivainc/otlp-exporter typecheck
pnpm --filter @convivainc/otlp-exporter test
```

## Guardrails

1. **Traces only.** Never add metric or log exporters. The gateway accepts
   `/v1/traces` only.
2. **No vendor SDKs.** No `@traceloop/*`, `@langfuse/*` or similar, as a
   dependency or an import (`test/boundaries.test.ts` checks this).
3. **The contract files come first.** Env names, headers, attribute names,
   domain and paths live in `sdks/contract/config-contract.json`. Mask keys
   live in `sdks/contract/mask-contract.json`. Edit the contract, then the code.
4. **Never rename or remove an attribute key** (`cvx.conversation_id`,
   `cnv.project_id`, source and baggage keys). You may only add.
5. **Processors** change spans in `onStart` only. They never throw and never
   overwrite a value the application set.
6. **Never generate a conversation id.** Only read one that already exists.
7. **Mask hook:**
   - Never pass conversation ids to it, even when `maskAttributes` lists them.
   - `maskAttributes` only adds to the built-in keys, never replaces them.
   - Never log the hook's error message; it may quote the content being masked.
8. **Validate first.** Throw `ConvivaTracingError` on bad input before touching
   any global state.
9. **Never log the customer key or put it on spans.** Only the hostname carries it.
10. **Never edit a version by hand.** Use `node scripts/set-version.mjs <version>`,
    then `node scripts/check-version.mjs`.
11. **Never mix OpenTelemetry SDK major versions** in the workspace. Use the
    versions the workspace already uses.

## Before you finish a change

- Tests pass, and the build and typecheck are clean.
- The Python twin has the same change and test (`camelCase` here, `snake_case` there).
- README, INTEGRATION.md and `sdks/CHANGELOG.md` are updated if behaviour changed.

## Using it in an app

- An app with no instrumentation yet should use `@convivainc/agent-tracing` instead.
- Call `resolveConfig()` once at startup.
- Add `createConvivaSpanProcessors(config)` to the **same** provider as the
  exporting processor.
