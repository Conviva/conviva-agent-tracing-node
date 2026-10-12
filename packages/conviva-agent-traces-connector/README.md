# @convivainc/agent-traces-connector

An OpenTelemetry helper library that propagates W3C **baggage** into your traces
by copying allowlisted baggage entries onto every span your process starts.

It is the Node.js/TypeScript sibling of the Python
`conviva-agent-traces-connector` package and keeps identical behavior.

## What it does

1. **Extracts** W3C baggage entries whose key matches an allowlist (default:
   any key starting with `c3.`, e.g. `c3.client_id`, `c3.conv_id`,
   `c3.msg_id`) from the active OpenTelemetry context.
2. **Copies** those baggage entries as attributes onto **every** span the
   process starts, via a custom `SpanProcessor.onStart`.
3. **Ensures** the global propagator includes the W3C Baggage propagator + W3C
   Trace Context propagator, so incoming `baggage:` headers are parsed and
   outbound HTTP calls re-inject baggage.

## Non-goals

- It does **not** auto-instrument HTTP. Your host app must have its own OTel HTTP
  instrumentation for baggage to cross the wire.
- It does **not** redact or transform values.
- It does **not** replace an existing `TracerProvider`; it only attaches a span
  processor to the one you already have.

> **Using `@convivainc/agent-tracing`?** The connector is already a
> dependency of it, and `init()` installs it. This package is for applications
> that run their own OpenTelemetry setup.

## Install

Once published to the `@convivainc` npm scope:

```bash
npm install @convivainc/agent-traces-connector
```

To build from source within this repo (a pnpm workspace rooted at `sdks/`):

```bash
cd sdks
pnpm install
pnpm --filter @convivainc/agent-traces-connector build
```

Workspace packages depend on it as `"@convivainc/agent-traces-connector": "workspace:^"`.

`@opentelemetry/api` is a **peer dependency** (`^1.9.0`). Ensure your app
resolves a single copy of `@opentelemetry/api`.

## Quickstart

With OpenTelemetry JS SDK 2.x, add the processor to the provider's
`spanProcessors` (2.x providers no longer expose `addSpanProcessor`):

```typescript
import { BaggageSpanProcessor } from '@convivainc/agent-traces-connector';

new NodeSDK({ spanProcessors: [new BaggageSpanProcessor(), exportingProcessor] });
```

With an SDK 1.x provider, call `install` once, after you have created and
registered your OTel `TracerProvider`:

```typescript
import { install } from '@convivainc/agent-traces-connector';

install({ tracerProvider });
```

If you omit `tracerProvider`, the package uses the globally registered provider
from `@opentelemetry/api` (`trace.getTracerProvider()`).

## Configuration

```typescript
import { install } from '@convivainc/agent-traces-connector';

install({
  tracerProvider,
  config: {
    // Baggage keys to copy. Entries ending in "." are prefix matches;
    // other entries are exact matches. Default: ["c3."]
    allowlist: ['c3.', 'session_id'],
    // Prefix added to the resulting span attribute keys. Default: ""
    attributePrefix: 'conviva.',
    // Optional logger used for non-fatal warnings.
    logger: console,
  },
});
```

### Matching rules

- An entry that ends with `.` is a **prefix** match: `c3.` matches
  `c3.client_id` but not `c3client_id`.
- Any other entry is an **exact** match: `session_id` matches only `session_id`.

## Idempotency

`install` is idempotent per provider. Calling it multiple times against the same
`TracerProvider` will not add a second span processor; it returns the existing
processor. If the resolved provider does not support `addSpanProcessor` (e.g. the
API no-op/proxy provider), attachment is skipped gracefully but the propagator is
still registered.

## Propagator note

The OTel API does not expose reading the current propagator's children, so
`ensureBaggagePropagator()` sets a composite of the two standard propagators
(`W3CTraceContextPropagator` + `W3CBaggagePropagator`). If your host app already
registered a custom propagator it wants to keep, build and set your own composite
(including these two) instead of relying on this default.

## API

- `install(options?)` – attach the span processor and register the propagator.
- `BaggageSpanProcessor` – the `SpanProcessor` implementation.
- `Config`, `resolveConfig`, `ConnectorConfig` – configuration helpers/types.
- `ensureBaggagePropagator()` – register the composite propagator directly.

## Documentation

| | |
|---|---|
| [README.md](README.md) | What the package does and its API. |
| [INTEGRATION.md](INTEGRATION.md) | Step-by-step integration into an application. |
| [AGENTS.md](AGENTS.md) | Guidance for AI coding agents working on or with this package. |
