# Integration Guide — `@convivainc/agent-tracing` (Node.js)

This guide adds Conviva agent tracing to a Node.js / TypeScript AI agent. One
`init()` call:

- auto-instruments every LLM SDK, vector DB and agent framework OpenLLMetry
  supports (OpenAI, Anthropic, Bedrock, Vertex AI, LangChain / LangGraph,
  LlamaIndex, Pinecone, Chroma and the rest);
- copies the Conviva client's `c3.*` baggage (client, conversation and message
  ids) onto every span;
- stamps `cvx.conversation_id` and `cnv.project_id` on every span;
- exports **traces only** to `https://<customerKey>.agw.conviva.com/v1/traces`.

> **Already have instrumentation you want to keep?** Use
> [`@convivainc/otlp-exporter`](../conviva-otlp-exporter/INTEGRATION.md)
> underneath it instead.

---

## 1. Prerequisites

| | |
|---|---|
| Node.js | 20 or later |
| Module system | CommonJS, or ESM that loads instrumented libraries after `init()` — OpenLLMetry patches through the CJS loader |
| `@opentelemetry/api` | `^1.9.0`, a **peer dependency** — make sure the app resolves a single copy |
| Conviva credentials | a **customer key**, and optionally a **project id** |

---

## 2. Install

```bash
npm install @convivainc/agent-tracing @opentelemetry/api
# or
pnpm add @convivainc/agent-tracing @opentelemetry/api
```

`@convivainc/otlp-exporter` and `@convivainc/agent-traces-connector` come with
it. Do not install them separately unless you use them directly.

---

## 3. Configure

```bash
export CONVIVA_CUSTOMER_KEY=acme        # becomes https://acme.agw.conviva.com
export CONVIVA_PROJECT_ID=my-project   # optional
```

| Variable | Purpose |
|---|---|
| `CONVIVA_CUSTOMER_KEY` | Gateway subdomain. Required unless an endpoint override is set. |
| `CONVIVA_PROJECT_ID` | Optional. Sent as `X-Conviva-Project-Id` and stamped as `cnv.project_id`; without it, traces go to the account's default project. |
| `CONVIVA_OTLP_ENDPOINT` | Sends to another OTLP endpoint instead, e.g. a local collector. |
| `CONVIVA_TRACE_CONTENT` | `false` keeps prompts and completions off spans. On by default. |
| `OTEL_SERVICE_NAME` | Service name when `appName` is not passed. |

Every value can be passed to `init()` instead; an explicit option wins.

---

## 4. Initialize first

`init()` must run **before** the LLM and framework libraries are loaded, or they
are not instrumented. Put it in its own module and load that first.

`tracing.ts`:

```ts
import { init } from "@convivainc/agent-tracing";

init({ appName: "my-agent" });
```

`server.ts`:

```ts
import "./tracing";                 // first

// Loaded after init(), so OpenLLMetry can patch them.
const express = require("express");
const { OpenAI } = require("openai");
```

With ESM, put everything that imports an instrumented library in a module
imported **after** `./tracing`, or start Node with `--require ./dist/tracing.js`.

`init()` throws `ConvivaTracingError` on bad configuration before it changes any
global state. A second call warns and returns the first configuration.

---

## 5. Group spans into conversations

Wrap each user turn so its spans share a conversation id:

```ts
import { withAssociationProperties, withWorkflow } from "@convivainc/agent-tracing";

app.post("/chat", async (req, res) => {
  const reply = await withAssociationProperties({ session_id: req.body.conversationId }, () =>
    withWorkflow({ name: "chat_turn" }, () => agent.run(req.body.message)),
  );
  res.json({ reply });
});
```

`session_id` is read back as `cvx.conversation_id`. If the request comes from a
page running the Conviva client sensor, its `c3.conv_id` baggage is used when no
`session_id` is set — see §6.

Other manual helpers, all re-exported: `withTask`, `withAgent`, `withTool`,
`withConversation`, `withLLMCall`, `withVectorDBCall`, and the `workflow`,
`task`, `agent`, `tool`, `conversation` decorators.

---

## 6. Carry the Conviva client's ids

The Conviva client sensor sends a W3C `baggage` header:

```
baggage: c3.client_id=<id>,c3.conv_id=<id>,c3.msg_id=<id>
```

Once that baggage is in the active context, every span gets `c3.client_id`,
`c3.conv_id` and `c3.msg_id` as attributes. OpenLLMetry registers the baggage
propagator but does not instrument your HTTP server, so extract the header
yourself — or register `@opentelemetry/instrumentation-http`:

```ts
import { context, propagation } from "@opentelemetry/api";

app.use((req, _res, next) => {
  context.with(propagation.extract(context.active(), req.headers), next);
});
```

Copy other baggage keys, or prefix the attribute names, with the `baggage`
option:

```ts
init({ baggage: { allowlist: ["c3.", "tenant"], attributePrefix: "" } });
```

---

## 7. Options

```ts
init({
  appName: "my-agent",
  customerKey: "acme",                          // else CONVIVA_CUSTOMER_KEY
  projectId: "my-project",                      // else CONVIVA_PROJECT_ID
  attributes: { tenant: "acme", env: "prod" },  // stamped on every span
  conversationId: { sourceAttributes: ["app.thread_id"] },
  baggage: { allowlist: ["c3."] },
  spanProcessors: [new MyProcessor()],          // run after Conviva's
  traceContent: false,                          // keep payloads off spans
  disableBatch: true,                           // export each span as it ends
  instrumentModules: { openAI: OpenAI },        // explicit module instrumentation
});
```

Every other OpenLLMetry `initialize()` option passes through, except `baseUrl`,
`exporter`, `processor` and `gcpProjectId`, which this package owns.

---

## 8. Flush before exit

Batches are exported in the background. Short-lived processes — scripts, CLIs,
serverless handlers — must flush:

```ts
import { forceFlush } from "@convivainc/agent-tracing";

await forceFlush();
```

`shutdown()` only flushes: OpenLLMetry exposes no way to uninstall
instrumentation, so tracing cannot be restarted in the same process.

---

## 9. Verify

1. Run against a local collector: `CONVIVA_OTLP_ENDPOINT=http://localhost:4318`
   (Jaeger all-in-one works).
2. Send one request, with a `baggage: c3.conv_id=test-1` header.
3. Check that the LLM spans exist and that every span carries
   `cvx.conversation_id` and `c3.conv_id` (and `cnv.project_id`, if you set one).
4. Unset the override to send to Conviva.

Delivery failures go to OpenTelemetry's `diag` channel, which is silent by
default. While integrating:

```ts
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
```

---

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| No LLM spans | The LLM library was loaded before `init()`. Load it after, or pass it in `instrumentModules`. |
| No `c3.*` attributes | The `baggage` header was not extracted into context (§6), or the client did not send it. |
| No `cvx.conversation_id` | No `session_id` association property and no `c3.conv_id` baggage. |
| Spans missing at exit | No `forceFlush()` before the process ended. |
| `Instrumentation exception: Unknown model` | OpenLLMetry's token estimator does not know a non-OpenAI model. Set `TRACELOOP_ENRICH_TOKENS=false`; token usage still comes from the model response. |
| HTTP or database spans also exported | Expected: every span on the global provider is exported. |
