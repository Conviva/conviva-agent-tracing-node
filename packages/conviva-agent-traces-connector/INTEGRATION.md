# Integration Guide — `@convivainc/agent-traces-connector` (Node.js)

This guide shows how to add the Conviva Agent Traces Connector to a Node.js /
TypeScript backend. The connector reads the `c3.*` W3C **baggage** that the
Conviva client sensor attaches to each request, stamps those values onto every
OpenTelemetry span your process produces, and makes sure the baggage is
re-injected onto outbound HTTP calls so upstream services receive it too.

Install the published package from the `@convivainc` npm scope — you do not need
any source from this repository.

> **Using `@convivainc/agent-tracing`?** You do not need this guide. The
> connector is a dependency of the agent tracing SDK and `init()` installs it
> for you. Pass `baggage: { ... }` to `init()` to change its configuration.

---

## 1. What the connector does

1. **Extracts** baggage entries whose key matches an allowlist (default: any key
   starting with `c3.`, e.g. `c3.client_id`, `c3.conv_id`, `c3.msg_id`) from the
   active OpenTelemetry context.
2. **Stamps** them as attributes on **every** span your process starts, via a
   custom `SpanProcessor.onStart`. This applies to spans from any instrumentation
   (HTTP, OpenLLMetry, manual) — not just LLM spans.
3. **Registers** the W3C Baggage + Trace Context propagators globally, so
   incoming `baggage:` headers are parsed and outbound HTTP calls re-inject them.

### What it does NOT do

- It does **not** auto-instrument HTTP. Your app must already have OpenTelemetry
  HTTP server/client instrumentation (see prerequisites) — that is what puts the
  incoming baggage into context and injects it on outbound calls.
- It does **not** redact or transform values.
- It does **not** replace your `TracerProvider`; it only attaches a span
  processor to the one you already have.

---

## 2. Prerequisites

Your service should already emit OpenTelemetry traces. A typical setup uses:

| Concern | Package |
|---|---|
| OTel SDK + exporter | `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http` |
| HTTP/framework instrumentation (baggage extract + inject) | `@opentelemetry/auto-instrumentations-node` |
| LLM spans (optional) | `@traceloop/node-server-sdk` (OpenLLMetry) |

`@opentelemetry/api` is a **peer dependency** of the connector (`^1.9.0`).
Ensure your app resolves a single copy of `@opentelemetry/api`.

---

## 3. Install

```bash
npm install @convivainc/agent-traces-connector
# or
yarn add @convivainc/agent-traces-connector
# or
pnpm add @convivainc/agent-traces-connector
```

---

## 4. Quick start

With OpenTelemetry JS SDK **2.x** (`NodeSDK`, `NodeTracerProvider`), add the
processor where you build the provider — 2.x providers take processors in their
constructor and no longer expose `addSpanProcessor`:

```typescript
import { BaggageSpanProcessor } from '@convivainc/agent-traces-connector';

const sdk = new NodeSDK({
  spanProcessors: [new BaggageSpanProcessor(), new BatchSpanProcessor(exporter)],
  // ...
});
```

`NodeSDK` already registers the W3C trace-context and baggage propagators.

With an SDK **1.x** provider, call `install()` **once**, immediately after your
OTel SDK/provider has been registered as the global provider.

```typescript
import { install } from '@convivainc/agent-traces-connector';

// ... after sdk.start() / provider registration ...
install();
```

With no arguments the connector attaches to the globally registered
`TracerProvider` (`trace.getTracerProvider()`) and registers the baggage
propagator.

---

## 5. Ordering matters

Instrumentation must patch `http` **before** your web framework and HTTP clients
are loaded, and `install()` must run **after** the global provider exists. Put
all tracing setup in a dedicated module that is imported first.

`tracing.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BaggageSpanProcessor } from '@convivainc/agent-traces-connector';

export function initTracing(): void {
  const exporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  });
  const sdk = new NodeSDK({
    serviceName: 'my-agent-backend',
    // The baggage processor goes first so c3.* is on the span before export.
    spanProcessors: [new BaggageSpanProcessor(), new BatchSpanProcessor(exporter)],
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
}
```

`server.ts` (initialize tracing before anything else):

```typescript
import { initTracing } from './tracing';
initTracing();

// Load framework/clients AFTER tracing is initialized so instrumentation
// patches are in place. Using require() avoids TS hoisting import above init.
const express = require('express');

const app = express();
app.use(express.json());

app.post('/chat', async (req, res) => {
  // Every span created during this request already carries c3.* attributes,
  // because the inbound `baggage:` header was extracted into context.
  res.json({ ok: true });
});

app.listen(process.env.PORT ?? 8001);
```

> If you prefer ESM `import` over `require`, put the framework/client imports in a
> separate module that is imported *after* `initTracing()` runs, so TypeScript /
> the runtime does not hoist them above initialization.

### Attaching to an explicit provider

If you manage your own SDK 1.x `NodeTracerProvider` / `BasicTracerProvider`
rather than using the global one (on 2.x, pass the processor to its constructor
as shown above):

```typescript
import { install } from '@convivainc/agent-traces-connector';

install({ tracerProvider: myProvider });
```

---

## 6. Configuration

```typescript
import { install } from '@convivainc/agent-traces-connector';

install({
  config: {
    // Baggage keys to copy. An entry ending in "." is a PREFIX match;
    // any other entry is an EXACT match. Default: ["c3."]
    allowlist: ['c3.', 'session_id'],

    // Prefix added to the resulting span attribute keys. Default: ""
    // e.g. "conviva." turns c3.conv_id into conviva.c3.conv_id
    attributePrefix: '',

    // Optional logger for non-fatal warnings. Default: none.
    logger: console,
  },
});
```

| Option | Type | Default | Meaning |
|---|---|---|---|
| `allowlist` | `string[]` | `["c3."]` | Baggage keys to copy. `"c3."` (trailing dot) = prefix match; `"session_id"` = exact match. |
| `attributePrefix` | `string` | `""` | String prepended to each span-attribute key. |
| `logger` | `{ warn(msg): void }` | none | Receives non-fatal warnings. |

### Matching rules

- `"c3."` matches `c3.client_id`, `c3.conv_id`, `c3.msg_id` (prefix; trailing dot required).
- `"session_id"` matches only `session_id` (exact).

---

## 7. How baggage crosses process boundaries

The connector copies baggage **onto spans within your process**. Getting the
baggage *into* your process and *out* to the next one is the job of the OTel HTTP
instrumentation plus the propagator the connector registers:

```
Inbound request (baggage: c3.*)
        │  HTTP server instrumentation extracts baggage → active context
        ▼
Your spans  ──(connector stamps c3.* on each)
        │  HTTP client instrumentation injects baggage on outbound calls
        ▼
Upstream service receives baggage: c3.*  → repeats there
```

For the upstream hop to work, the upstream service must also run OTel HTTP
server instrumentation (and, to stamp its own spans, this connector).

---

## 8. Verify

1. Point your OTLP exporter at a collector/Jaeger (e.g. Jaeger all-in-one on
   `:4318`).
2. Send a request carrying the baggage header:

   ```bash
   curl -X POST http://localhost:8001/chat \
     -H 'Content-Type: application/json' \
     -H 'baggage: c3.client_id=abc,c3.conv_id=conv1,c3.msg_id=m1' \
     -d '{"text":"hello"}'
   ```
3. Open the trace and confirm **every** span (HTTP server span, your handler
   span, LLM spans, outbound client spans) has `c3.client_id`, `c3.conv_id`, and
   `c3.msg_id` attributes.

---

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| No `c3.*` on any span | On SDK 2.x, `install()` cannot attach — pass `BaggageSpanProcessor` in `spanProcessors`. On 1.x, `install()` ran before the global provider existed, or attached to a different provider than the one exporting. |
| Only the HTTP server span is missing baggage, children have it | The server span may start before extraction on some setups; ensure `@opentelemetry/instrumentation-http` is enabled. |
| Downstream service has no baggage | The outbound call was made by a client the OTel instrumentation does not patch, or the upstream did not register a baggage propagator. |
| Duplicate span processors | `install()` is idempotent per provider; do not also add `BaggageSpanProcessor` manually. |
| Baggage attributes appear on spans you did not expect | By design the connector stamps *every* span whose context carries the baggage. Narrow `allowlist`, or filter downstream. |

---

## 10. API reference

```typescript
import {
  install,
  BaggageSpanProcessor,
  Config,
  resolveConfig,
  DEFAULT_CONFIG,
  ensureBaggagePropagator,
  VERSION,
  type ConnectorConfig,
} from '@convivainc/agent-traces-connector';
```

- `install(options?: { tracerProvider?, config?: ConnectorConfig }): BaggageSpanProcessor | undefined`
  — attach the span processor and register the propagator. Idempotent per provider.
- `BaggageSpanProcessor` — the `SpanProcessor` implementation, if you want to add
  it manually.
- `ensureBaggagePropagator(): void` — register the composite
  (`W3CTraceContextPropagator` + `W3CBaggagePropagator`) without attaching a
  processor.
- `Config`, `resolveConfig`, `DEFAULT_CONFIG`, `ConnectorConfig` — configuration
  helpers and type.
- `VERSION` — package version string.

> **Propagator note:** the OTel API cannot read a currently-registered
> propagator's children, so `ensureBaggagePropagator()` sets a composite of the
> two standard propagators. If your app already registered a custom propagator it
> must keep, build your own composite that includes `W3CTraceContextPropagator`
> and `W3CBaggagePropagator` and set it yourself instead of relying on this
> default.
