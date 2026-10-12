# AGENTS.md — `@convivainc/agent-traces-connector`

Guidance for AI coding agents working on this package, or integrating it into
an application. Human docs: [README.md](README.md), [INTEGRATION.md](INTEGRATION.md).

## What this package is

A small OpenTelemetry helper that copies allowlisted W3C **baggage** entries
onto every span at start time. Its job is to carry the Conviva client sensor's
ids — `c3.client_id`, `c3.conv_id`, `c3.msg_id` — from the inbound `baggage`
header onto backend spans.

`@convivainc/agent-tracing` depends on it and installs it in `init()`. It also
ships and works alone with any OpenTelemetry setup.

Python twin: [`packages/python/conviva-agent-traces-connector`](../../python/conviva-agent-traces-connector).

## Layout

```
src/
  index.ts        public entry point; exports VERSION
  config.ts       Config / resolveConfig / ConnectorConfig — allowlist and prefix
  processor.ts    BaggageSpanProcessor
  install.ts      install() — attach to an SDK 1.x provider, register propagator
  propagation.ts  ensureBaggagePropagator()
test/             vitest
```

## Commands

Run from `sdks/`:

```bash
pnpm install
pnpm --filter @convivainc/agent-traces-connector build
pnpm --filter @convivainc/agent-traces-connector typecheck
pnpm --filter @convivainc/agent-traces-connector test
```

## Rules that must hold

1. **Keep the keys.** The default allowlist is `["c3."]` and attribute names
   equal the baggage keys (empty default prefix). The Conviva gateway and the
   exporter's conversation-id fallback (`c3.conv_id`) depend on that.
2. **Allowlist matching:** an entry ending in `.` is a prefix match; anything
   else is exact. Never widen the default to copy all baggage — baggage can
   carry PII and high-cardinality values.
3. **Never throw from `onStart`.** Failures go to the optional logger.
4. **No exporting, no transport.** This package only decorates spans; it has no
   dependency on the exporter or on any vendor SDK.
5. **OpenTelemetry SDK 2.x.** Providers no longer have `addSpanProcessor`, so
   the supported path is passing `BaggageSpanProcessor` to the provider's
   `spanProcessors`. `install()` stays for 1.x providers and must degrade
   gracefully (return `undefined`) on 2.x.
6. **Parity with Python.** Same defaults and matching rules.

## Releasing

Lockstep from `sdks/VERSION`; `set-version.mjs` also rewrites the `VERSION`
constant in `src/index.ts`. Run `node scripts/check-version.mjs` before a
release.

## Integrating it into an app

- Using `@convivainc/agent-tracing`? Do nothing — configure it through
  `init({ baggage })`.
- Otherwise add `new BaggageSpanProcessor()` **first** in the provider's
  `spanProcessors`, before the exporting processor.
- Inbound baggage must be extracted into context by HTTP instrumentation or
  `propagation.extract`; this package does not instrument HTTP.
