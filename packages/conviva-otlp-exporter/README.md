# @convivainc/otlp-exporter

The Conviva transport layer for Node.js. Resolves the gateway destination and
routing headers, builds the OTLP http/protobuf trace exporter, and supplies the
span processors that stamp the ids Conviva correlates on.

It depends on no vendor SDK — no OpenLLMetry, no Langfuse — so you can drop it
underneath whichever instrumentation library you already have. If you want
auto-instrumentation as well, use
[`@convivainc/agent-tracing`](../conviva-agent-tracing), which is this package
plus OpenLLMetry and the Conviva baggage connector.

The JS mirror of [`conviva-otlp-exporter`](../../python/conviva-otlp-exporter).

## Install

```bash
npm install @convivainc/otlp-exporter
```

`@opentelemetry/api` (`^1.9.0`) is a peer dependency. Node.js 20 or later.

## Configure

Two values, and nothing else — the second is optional:

| | |
|---|---|
| **customer key** | `customerKey` or `CONVIVA_CUSTOMER_KEY`. Becomes the subdomain: `https://<customerKey>.agw.conviva.com`. |
| **project id** | `projectId` or `CONVIVA_PROJECT_ID`. Sent as the `X-Conviva-Project-Id` header and written onto every span as `cnv.project_id`. Optional: without it, traces go to the account's default project. |

## Use

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  createConvivaSpanProcessors,
  createTraceExporter,
  resolveConfig,
} from "@convivainc/otlp-exporter";

const config = resolveConfig(); // reads CONVIVA_CUSTOMER_KEY and CONVIVA_PROJECT_ID

new NodeSDK({
  spanProcessors: [
    ...createConvivaSpanProcessors(config),
    new BatchSpanProcessor(createTraceExporter(config)),
  ],
}).start();
```

The Conviva processors read attributes the instrumentation wrote during
`onStart`, so anything that writes those attributes in a processor of its own
has to run before them.

For an API that accepts only one processor — OpenLLMetry's
`initialize({ processor })` is the common case — wrap the stack:

```ts
const processor = new CompositeSpanProcessor(...createConvivaSpanProcessors(config));
```

## What the processors do

| Processor | Writes | Notes |
|---|---|---|
| `ConversationIdSpanProcessor` | `cvx.conversation_id`, `gen_ai.conversation.id` | Resolves from an explicit value, then span attributes (`traceloop.association.properties.session_id`, `session.id`, `gen_ai.conversation.id`), then baggage (`c3.conv_id`, `conversation_id`, `session_id`, `langfuse_session_id`). Never overwrites an existing value, and never generates one. |
| `ProjectIdSpanProcessor` | `cnv.project_id` | Not redundant with the header. Header plus resource attribute alone was observed to return HTTP 200 with nothing visible downstream; only the per-span attribute worked. |
| `AttributeSpanProcessor` | whatever you give it | Drops `undefined` and `""` once at construction. |
| `CompositeSpanProcessor` | — | Runs several as one, in argument order. |

All of them mutate in `onStart`. By `onEnd` the span is read-only.

## Endpoint precedence

Highest first:

1. the `endpoint` option
2. `CONVIVA_OTLP_ENDPOINT`
3. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
4. `OTEL_EXPORTER_OTLP_ENDPOINT`
5. derived — `https://<customerKey>.agw.conviva.com`

Rungs 3 and 4 let a stock OpenTelemetry operator point telemetry at a local
collector without knowing any Conviva-specific variable name. A configured
endpoint may include the signal path or not; `/v1/traces` is stripped and
re-appended either way.

## Traces only

This package exports traces to `https://<customerKey>.agw.conviva.com/v1/traces`
and nothing else: there is no metric or log exporter. A configured endpoint
that ends in `/v1/metrics` or `/v1/logs` is still accepted and reduced to its
base URL, so a value copied from a generic OTLP setup resolves correctly.

## The contract

Every constant here is authored in
[`contract/config-contract.json`](../../../contract/config-contract.json) at
the component root, and asserted by `test/contract.test.ts` — alongside the
Python exporter and the coding-agent hook engine, which read the same file.

## Test

```bash
pnpm --filter @convivainc/otlp-exporter test
```

## Documentation

| | |
|---|---|
| [README.md](README.md) | What the package does and its API. |
| [INTEGRATION.md](INTEGRATION.md) | Step-by-step integration into an application. |
| [AGENTS.md](AGENTS.md) | Guidance for AI coding agents working on or with this package. |
