# AGENTS.md — `@convivainc/agent-tracing`

The Conviva agent tracing SDK. It is a thin wrapper over OpenLLMetry
(`@traceloop/node-server-sdk`). `init()` auto-instruments LLM and framework
calls, copies the client sensor's `c3.*` baggage onto spans, writes the
conversation and project ids, and sends traces (only traces) to
`https://<customerKey>.agw.conviva.com/v1/traces`.

Python twin: [`../../python/conviva-agent-tracing`](../../python/conviva-agent-tracing).
Human docs: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md).

## Commands

Run from `sdks/`. Build all JS packages first, because this one uses the
others' `dist/`:

```bash
pnpm install
pnpm --filter "./packages/js/*" build
pnpm --filter @convivainc/agent-tracing typecheck
pnpm --filter @convivainc/agent-tracing test
```

## Guardrails

1. **Keep the processor order:** baggage connector, then Conviva processors,
   then the caller's `spanProcessors`. OpenLLMetry's own processor runs before
   all of them. Never reorder.
2. **Traces only.** Never enable metric or log export.
3. **Conviva owns the destination.** Never accept `baseUrl`, `exporter`,
   `processor` or `gcpProjectId` from callers.
4. **Conviva's own options never reach OpenLLMetry's `initialize()`.** When you
   add an option, add it to the test in `test/init.test.ts` that checks this.
5. **Validate first.** Bad config throws before any environment change or
   `initialize()` call.
6. **Trace content is resolved once** and set both as the `traceContent` option
   and as `TRACELOOP_TRACE_CONTENT`. OpenLLMetry reads it from both places.
7. **Re-export, don't wrap.** When you add a re-export, add it to the
   `vi.mock` in `test/init.test.ts`.
8. **OpenLLMetry is the only vendor SDK.** No Langfuse or LangSmith.
9. **Stay CommonJS.** OpenLLMetry patches through the CommonJS loader.
10. **Never edit a version by hand.** Use `node scripts/set-version.mjs <version>`,
    then `node scripts/check-version.mjs`. Publish the exporter and connector
    before this package.

## Before you finish a change

- Tests pass, and the build and typecheck are clean.
- The Python twin has the same change and test.
- README, INTEGRATION_GUIDE.md and `sdks/CHANGELOG.md` are updated if behaviour changed.

## Using it in an app

- Call `init()` in a module that loads **before** any LLM or framework library.
- Wrap each user turn in `withAssociationProperties({ session_id }, ...)` and
  `withWorkflow`, or rely on the client's `c3.conv_id` baggage.
- Make sure the inbound `baggage` header is extracted into the context, by HTTP
  instrumentation or `propagation.extract`.
- Call `forceFlush()` before a short-lived process exits.
- Never create a second `NodeSDK` or tracer provider next to it.
