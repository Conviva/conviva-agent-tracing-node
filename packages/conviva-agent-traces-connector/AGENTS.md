# AGENTS.md — `@convivainc/agent-traces-connector`

Copies allowlisted W3C **baggage** entries onto every span when the span
starts. This carries the Conviva client sensor's `c3.*` ids (for example
`c3.client_id` and `c3.conv_id`) from the inbound `baggage` header onto backend
spans. `@convivainc/agent-tracing` installs it; it also works with any
OpenTelemetry setup.

Python twin: [`../../python/conviva-agent-traces-connector`](../../python/conviva-agent-traces-connector).
Human docs: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md).

## Commands

Run from `sdks/`:

```bash
pnpm install
pnpm --filter @convivainc/agent-traces-connector build
pnpm --filter @convivainc/agent-traces-connector typecheck
pnpm --filter @convivainc/agent-traces-connector test
```

## Guardrails

1. **Keep the defaults.** The allowlist is `["c3."]`, and attribute names equal
   the baggage keys (no prefix). The gateway and the exporter depend on this.
2. **Never widen the default to copy all baggage.** Baggage can carry PII.
   An allowlist entry ending in `.` matches as a prefix; any other entry must
   match exactly.
3. **Never throw from `onStart`.** Report failures to the optional logger.
4. **Decorate spans only.** No exporting, no transport, no dependency on the
   exporter or on a vendor SDK.
5. **OpenTelemetry SDK 2.x:** pass `BaggageSpanProcessor` in the provider's
   `spanProcessors`. `install()` exists for 1.x providers and must return
   `undefined` on 2.x, never throw.
6. **Never edit a version by hand.** `node scripts/set-version.mjs <version>`
   also updates the `VERSION` constant in `src/index.ts`. Then run
   `node scripts/check-version.mjs`.

## Before you finish a change

- Tests pass, and the build and typecheck are clean.
- The Python twin has the same change and test.
- README, INTEGRATION.md and `sdks/CHANGELOG.md` are updated if behaviour changed.

## Using it in an app

- If the app uses `@convivainc/agent-tracing`, do nothing here. Configure it
  through `init({ baggage })`.
- Otherwise put `new BaggageSpanProcessor()` **first** in the provider's
  `spanProcessors`, before the exporting processor.
- Inbound baggage must be extracted into the context by HTTP instrumentation or
  `propagation.extract`. This package does not instrument HTTP.
