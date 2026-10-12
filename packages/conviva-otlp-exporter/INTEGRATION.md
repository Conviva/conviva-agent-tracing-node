# Integration Guide — `@convivainc/otlp-exporter` (Node.js)

This guide adds the Conviva transport layer to a Node.js / TypeScript service
that **already produces OpenTelemetry spans** — from Langfuse, OpenInference,
hand-written instrumentation, or anything else. It sends those spans to the
Conviva agent gateway and stamps the ids Conviva correlates on.

> **Starting from scratch, or using OpenLLMetry?** Use
> [`@convivainc/agent-tracing`](../conviva-agent-tracing/INTEGRATION.md)
> instead. It includes this package, OpenLLMetry auto-instrumentation and the
> Conviva baggage connector behind a single `init()`.

---

## 1. What you get

- **One exporter**: OTLP http/protobuf to
  `https://<customerKey>.agw.conviva.com/v1/traces`, with the
  `X-Conviva-Project-Id` header on every request. Traces only — there is no
  metric or log exporter.
- **Span processors** that stamp:
  - `cnv.project_id` — the project the span belongs to;
  - `cvx.conversation_id` — the conversation, read from whatever your
    instrumentation already wrote (see §6);
  - any fixed attributes you choose, such as a tenant.

No vendor SDK comes with it, so it does not change how your spans are created.

---

## 2. Prerequisites

| | |
|---|---|
| Node.js | 20 or later |
| `@opentelemetry/api` | `^1.9.0`, a **peer dependency** — make sure the app resolves a single copy |
| OpenTelemetry SDK | 2.x (`@opentelemetry/sdk-node` or `@opentelemetry/sdk-trace-node`) |
| Conviva credentials | a **customer key**, and optionally a **project id** |

---

## 3. Install

```bash
npm install @convivainc/otlp-exporter
# or
pnpm add @convivainc/otlp-exporter
```

---

## 4. Configure

Set them in the environment:

```bash
export CONVIVA_CUSTOMER_KEY=acme        # becomes https://acme.agw.conviva.com
export CONVIVA_PROJECT_ID=my-project   # optional
```

or pass them in code: `resolveConfig({ customerKey, projectId })`. An explicit
option wins over the environment.

| Variable | Purpose |
|---|---|
| `CONVIVA_CUSTOMER_KEY` | Gateway subdomain. Must be a valid DNS label. |
| `CONVIVA_PROJECT_ID` | Optional. Header and `cnv.project_id`; without it, traces go to the account's default project. |
| `CONVIVA_OTLP_ENDPOINT` | Overrides the derived endpoint, e.g. a local collector. With it set, no customer key is needed. |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_ENDPOINT` | Honoured after `CONVIVA_OTLP_ENDPOINT`, so a stock OpenTelemetry setup can redirect traces too. |
| `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_EXPORTER_OTLP_TRACES_HEADERS` | Extra request headers. The project header cannot be overridden. |

`resolveConfig()` throws `ConvivaTracingError` on a
missing customer key (with no endpoint override), or a customer key that is not
a hostname label. Call it at startup so a bad configuration fails fast.

---

## 5. Wire it in

Create the tracing module first and import it before anything you want traced.

### With `NodeSDK`

`tracing.ts`:

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  createConvivaSpanProcessors,
  createTraceExporter,
  resolveConfig,
} from "@convivainc/otlp-exporter";

const config = resolveConfig();

export const sdk = new NodeSDK({
  serviceName: "my-agent",
  spanProcessors: [
    ...createConvivaSpanProcessors(config, {
      attributes: { tenant: process.env.TENANT },
    }),
    new BatchSpanProcessor(createTraceExporter(config)),
  ],
  // instrumentations: [...]
});

sdk.start();

process.on("SIGTERM", () => void sdk.shutdown());
```

### With an API that takes a single processor

Wrap the stack in `CompositeSpanProcessor`:

```ts
import { CompositeSpanProcessor, createConvivaSpanProcessors } from "@convivainc/otlp-exporter";

const processor = new CompositeSpanProcessor(...createConvivaSpanProcessors(config));
```

### Ordering

The Conviva processors read attributes during `onStart`. A processor of your
own that **writes** a conversation attribute must come **before** them; one that
reads `cvx.conversation_id` must come **after**.

---

## 6. Conversation ids

`ConversationIdSpanProcessor` writes `cvx.conversation_id`, taking the first of:

1. the explicit `conversationId.conversationId` option;
2. a span attribute: `traceloop.association.properties.session_id`,
   `session.id`, `gen_ai.conversation.id`;
3. a baggage entry: `c3.conv_id` (the Conviva client sensor's), `conversation_id`,
   `session_id`, `langfuse_session_id`.

It never overwrites an existing `cvx.conversation_id` and never invents one. If
your instrumentation uses other names, pass them:

```ts
createConvivaSpanProcessors(config, {
  conversationId: { sourceAttributes: ["app.thread_id"], baggageKeys: ["thread_id"] },
});
```

To get the Conviva client's `c3.client_id` and `c3.msg_id` onto spans as well,
add [`@convivainc/agent-traces-connector`](../conviva-agent-traces-connector).

---

## 7. Verify

1. Point the exporter at a local collector:
   `CONVIVA_OTLP_ENDPOINT=http://localhost:4318` (Jaeger all-in-one works).
2. Make one traced request.
3. Confirm that spans inside a conversation carry `cvx.conversation_id`,
   and every span carries `cnv.project_id` if you set a project id.
4. Unset the override to send to the gateway.

Export failures go to OpenTelemetry's `diag` channel, which is silent by
default. While integrating, attach a logger:

```ts
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
```

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ConvivaTracingError` at startup | No customer key (and no endpoint), or one with characters a hostname cannot contain. |
| HTTP 200 but nothing in Conviva | Spans lack a conversation id, or went to the default project because no project id is set. |
| No `cvx.conversation_id` | None of the §6 sources is present. Set one, or pass your own source names. |
| Spans go to the wrong place | An `OTEL_EXPORTER_OTLP_*` variable or `CONVIVA_OTLP_ENDPOINT` is set. See the precedence in the README. |
| Spans lost on exit | The batch processor was not flushed. Call `sdk.shutdown()` or `forceFlush()` before exit. |

---

## 9. API reference

```ts
import {
  resolveConfig, parseKeyPairs, ConvivaTracingError,
  createTraceExporter,
  createConvivaSpanProcessors, CompositeSpanProcessor,
  ConversationIdSpanProcessor, ProjectIdSpanProcessor, AttributeSpanProcessor,
  CONVERSATION_ID_ATTRIBUTE, PROJECT_ID_ATTRIBUTE, PROJECT_ID_HEADER,
  CUSTOMER_KEY_ENV, PROJECT_ID_ENV, ENDPOINT_ENV, GATEWAY_DOMAIN, TRACES_PATH,
  DEFAULT_SOURCE_ATTRIBUTES, DEFAULT_BAGGAGE_KEYS, ASSOCIATION_PROPERTY_PREFIX,
  type ConvivaConfigOptions, type ResolvedConfig,
  type ConversationIdOptions, type ConvivaSpanProcessorOptions,
} from "@convivainc/otlp-exporter";
```

| | |
|---|---|
| `resolveConfig(options?, env?)` | Endpoint, traces URL, headers and project id. Throws on bad input. |
| `createTraceExporter(config)` | The OTLP http/protobuf trace exporter. |
| `createConvivaSpanProcessors(config, options?)` | `[ConversationId, ProjectId, Attribute?]`, in the order they must run. |
| `CompositeSpanProcessor(...processors)` | Runs several processors as one, in argument order. |
