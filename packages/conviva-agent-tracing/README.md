# @convivainc/agent-tracing

OpenLLMetry auto-instrumentation, exporting to Conviva. Wraps
[`@traceloop/node-server-sdk`](https://github.com/traceloop/openllmetry-js) so
the LLM, vector-DB and agent-framework libraries it supports are instrumented
automatically, and routes the resulting spans to the Conviva agent gateway with
`cvx.conversation_id` and `cnv.project_id` on every span. Traces only — no
metrics or logs are exported.

It is built from two Conviva packages, both installed as dependencies and both
usable on their own:

| Package | Role here |
|---|---|
| [`@convivainc/otlp-exporter`](../conviva-otlp-exporter) | The OTLP exporter to `https://<customerKey>.agw.conviva.com/v1/traces`, and the span processors that stamp `cvx.conversation_id` and `cnv.project_id`. |
| [`@convivainc/agent-traces-connector`](../conviva-agent-traces-connector) | Copies the Conviva client's `c3.*` W3C baggage — client id, conversation id, message id — onto every span. |

The JS mirror of [`conviva-agent-tracing`](../../python/conviva-agent-tracing)
— same shape, `camelCase` names.

## Install

```bash
npm install @convivainc/agent-tracing
```

`@opentelemetry/api` (`^1.9.0`) is a peer dependency. Node.js 20 or later.

## Use

```ts
import { init } from "@convivainc/agent-tracing";

// Reads CONVIVA_CUSTOMER_KEY and CONVIVA_PROJECT_ID from the environment.
init({ appName: "flight-booking" });
```

Call `init()` **before** importing the libraries you want instrumented —
OpenLLMetry patches modules as they are loaded. The package is CommonJS for
the same reason: the patching hooks the CJS loader.

Two values configure it, and nothing else — the second is optional:

| | |
|---|---|
| **customer key** | `customerKey` or `CONVIVA_CUSTOMER_KEY`. Becomes the subdomain: `https://<customerKey>.agw.conviva.com`. |
| **project id** | `projectId` or `CONVIVA_PROJECT_ID`. Sent as the `X-Conviva-Project-Id` header and written onto every span as `cnv.project_id`. Optional: without it, traces go to the account's default project. |

Both are resolved by `@convivainc/otlp-exporter`, so the endpoint precedence
and header rules documented there apply unchanged.

## API

| | |
|---|---|
| `init(options?) → ResolvedConfig` | Initialize. Idempotent: a second call warns and returns the cached config. Throws `ConvivaTracingError` on bad configuration, before touching any global state. |
| `getConfig()` | The active `ResolvedConfig`, or `undefined` before `init()`. |
| `forceFlush()` | Drain the batch processor. Call before a short-lived process exits. |
| `shutdown()` | Flush pending spans — see the caveat below. |
| `BaggageSpanProcessor`, `ensureBaggagePropagator` | The connector, re-exported. `init()` already installs it. |

OpenLLMetry's manual-instrumentation API is re-exported, so an application
depends on this package alone: `withWorkflow`, `withTask`, `withAgent`,
`withTool`, `withConversation`, `withLLMCall`, `withVectorDBCall`,
`withAssociationProperties`, the `workflow` / `task` / `agent` / `tool` /
`conversation` decorators, `AssociationProperty`, `LLMSpan`, `VectorSpan` and
`getTracer`.

Every OpenLLMetry `initialize()` option except the ones this package owns
(`baseUrl`, `exporter`, `processor`, `gcpProjectId`) passes straight through:
`instrumentModules`, `disableBatch`, `traceContent`, `propagator` and the rest.

```ts
init({
  appName: "flight-booking",
  conversationId: { conversationId: "conv-42" }, // or let the processor resolve it
  attributes: { tenant: "acme" },                // stamped on every span
  spanProcessors: [new MyProcessor()],           // composed after Conviva's
  baggage: { allowlist: ["c3.", "tenant"] },     // which baggage reaches spans
});
```

## Conviva client baggage

The Conviva client sensor sends `c3.client_id`, `c3.conv_id` and `c3.msg_id`
in the W3C `baggage` header. `init()` installs the connector's
`BaggageSpanProcessor` ahead of the Conviva processors, so every span started
while that baggage is in context carries those entries as attributes under
their own names. OpenLLMetry's `NodeSDK` registers the W3C baggage propagator;
your HTTP server instrumentation still has to extract the header into context.

## Conversation ids

`ConversationIdSpanProcessor` resolves one from, in order: the explicit
`conversationId.conversationId` option → span attributes
(`traceloop.association.properties.session_id`, `session.id`,
`gen_ai.conversation.id`) → baggage (`c3.conv_id`, `conversation_id`,
`session_id`, `langfuse_session_id`). Ids are only extracted, never generated:
a span with none of these carries no `cvx.conversation_id`. The usual path is
the second:

```ts
withAssociationProperties({ session_id: conversationId }, () =>
  withWorkflow({ name: "turn" }, handleTurn),
);
```

Override the source lists with `conversationId.sourceAttributes` and
`conversationId.baggageKeys` if your application names them differently.

## Prompts and completions

Recorded on spans by default. Set `CONVIVA_TRACE_CONTENT=false` (or pass
`traceContent: false`) to keep message content off spans; OpenLLMetry's own
`TRACELOOP_TRACE_CONTENT` is honoured when the Conviva variable is unset.

### Masking PII

The SDK does not detect or mask PII itself; Conviva masks centrally, after
ingest. To mask before data leaves your process, pass a `mask` function and
call the engine of your choice (regex, Presidio, your DLP). Off by default.

```ts
init({
  // Called for each content attribute just before export. Return the new
  // value, or undefined to drop the attribute.
  mask: ({ value }) =>
    typeof value === "string" ? value.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>") : value,
});
```

The hook sees content attributes only, on the span and on its events
(`gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.prompt.*`,
`gen_ai.completion.*`, `traceloop.entity.input/output`,
`traceloop.prompt.template_variables.*`, `traceloop.association.properties.*`,
`exception.message`/`exception.stacktrace`, ...; the full list is in
`sdks/contract/mask-contract.json`). `event` names the span event an attribute
came from, and is `undefined` for span attributes. The hook is also called for
the span's status description (key `otel.status_description`), which often
repeats the exception message. Conversation ids and the client sensor's
`c3.client_id` / `c3.conv_id` are never passed to it.

- **Synchronous and fast.** An `async` function is rejected by `init`. The hook
  runs on the event loop during export, so a slow one (a network call to a
  redaction service) delays your application.
- **Fails closed.** If it throws or returns something that is not an attribute
  value (a string, number, boolean or an array of one of those), that
  attribute is dropped and the span still exports. A warning naming the
  attribute and the error type is logged at most once a minute; the error
  message is never logged.
- **Read-only.** `span` is a frozen view; do not modify it. Spans are not
  changed in place: a masked copy is exported, and other exporters see the
  original.

#### Content under other attribute names

The hook only sees the keys above. If other instrumentation on the same
provider records content under different names (OpenInference's
`input.value` / `output.value`, your own `app.payload.*`), list them in
`maskAttributes`; an entry ending in `*` is a prefix. They are masked on top of
the built-in keys, which are always masked; conversation ids and
`c3.client_id` / `c3.conv_id` are still never passed to the hook. `maskAttributes`
without `mask` is rejected by `init`.

```ts
init({ mask, maskAttributes: ["input.value", "output.value", "app.payload.*"] });
```

## Two things to know

**`shutdown()` only flushes.** OpenLLMetry keeps its `NodeSDK` private and
exposes no shutdown hook, so instrumentation stays installed and tracing cannot
be restarted in the same process. The Python wrapper has the same limitation.

**Every span is exported, not just LLM spans.** OpenLLMetry installs no scope
filter, so spans from any HTTP or database instrumentation on the global
provider go to Conviva too.

## Traces only

Nothing but traces goes to Conviva. `init()` sets `OTEL_METRICS_EXPORTER` and
`OTEL_LOGS_EXPORTER` to `none` unless you have set them yourself, and the
exporter package has no metric or log exporter.

## Test

```bash
pnpm --filter @convivainc/agent-tracing test
```

## Documentation

| | |
|---|---|
| [README.md](README.md) | What the package does and its API. |
| [INTEGRATION.md](INTEGRATION.md) | Step-by-step integration into an application. |
| [AGENTS.md](AGENTS.md) | Guidance for AI coding agents working on or with this package. |
