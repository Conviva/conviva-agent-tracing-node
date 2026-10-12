# Conviva Agent Tracing — Integration Guide for Node.js

Conviva Agent Tracing gives you end-to-end visibility into your AI agents. Add
one line to your application and every LLM call, tool call, retrieval and
agent-framework step is traced and sent to Conviva — grouped by conversation,
and joined to the end-user session your Conviva client sensor measures.

It is built on OpenTelemetry, so it works alongside any tracing you already
have. This guide covers Node.js and TypeScript; a Python edition is available
as `conviva-agent-tracing` on PyPI.

## Contents

1. [Integration options](#1-integration-options)
2. [Quick start — option 1, full SDK](#2-quick-start--option-1-full-sdk)
3. [Supported integrations](#3-supported-integrations)
4. [Tracing workflows, tasks, agents and tools](#4-tracing-workflows-tasks-agents-and-tools)
5. [Conversations and association properties](#5-conversations-and-association-properties)
6. [Connecting the Conviva client sensor — option 3](#6-connecting-the-conviva-client-sensor--option-3)
7. [Manual LLM and vector-database instrumentation](#7-manual-llm-and-vector-database-instrumentation)
8. [Privacy: prompts and completions](#8-privacy-prompts-and-completions)
9. [Exporter only — option 2](#9-exporter-only--option-2)
10. [Configuration reference](#10-configuration-reference)
11. [API reference](#11-api-reference)
12. [Verifying your integration](#12-verifying-your-integration)
13. [Limitations](#13-limitations)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Integration options

There are three ways to integrate. Pick **one** of the first two, and add the
third if your web or mobile app runs the Conviva client sensor.

| | Option | Use it when | You install |
|---|---|---|---|
| **1** | **Full SDK** | You want traces with the least work, or your agent has no tracing yet. | `@convivainc/agent-tracing` |
| **2** | **Exporter only** | Your agent already uses an OpenTelemetry-based tracing library (Langfuse, OpenInference, Arize, your own spans…) and you want to keep it. | `@convivainc/otlp-exporter` |
| **3** | **Traces connector**, added to 1 or 2 | Your front end runs the Conviva client sensor, and you want each agent trace joined to the user's session in Conviva. | Nothing more with option 1; `@convivainc/agent-traces-connector` with option 2 |

```text
Does your agent already create OpenTelemetry spans you want to keep?
├── No  → Option 1: Full SDK
└── Yes → Option 2: Exporter only

Does your web or mobile app run the Conviva client sensor?
└── Yes → also add Option 3: Traces connector
```

### Option 1 — Full SDK

One `init()` call instruments every supported LLM SDK, vector database and
agent framework automatically (§3), and sends the traces to Conviva. It
includes the exporter and the traces connector, so option 3 needs no extra
package.

```ts
import { init } from "@convivainc/agent-tracing";
init({ appName: "travel-assistant" });
```

Full walkthrough: §2. Annotating your own workflows, tools and conversations:
§4 – §5.

### Option 2 — Exporter only

Keeps your existing instrumentation and changes only where the spans go. You
add the Conviva exporter and span processors to the OpenTelemetry tracer
provider you already have; nothing else in your code changes.

```ts
spanProcessors: [
  ...createConvivaSpanProcessors(config),
  new BatchSpanProcessor(createTraceExporter(config)),
]
```

Full walkthrough: §9.

### Option 3 — Traces connector (with option 1 or 2)

The Conviva client sensor sends three ids with every request to your backend:
the client, the conversation and the message. The traces connector copies them
onto every span of the agent work that request causes, so Conviva can join the
agent trace to the user's session, and uses the conversation id to group turns
when your code does not set one.

| Combined with | What you do |
|---|---|
| Option 1 | Nothing to install — the connector is part of the SDK. Make sure the client sensor's header reaches your agent (§6). |
| Option 2 | Install the connector and add its span processor ahead of the Conviva processors (§9), then the same wiring (§6). |

```ts
// Option 2 + 3
spanProcessors: [
  new BaggageSpanProcessor(),               // the traces connector
  ...createConvivaSpanProcessors(config),
  new BatchSpanProcessor(createTraceExporter(config)),
]
```

Full walkthrough: §6.

### What each option gives you

| | Option 1 | Option 2 | Option 3 (added) |
|---|:---:|:---:|:---:|
| Automatic tracing of LLM SDKs, vector DBs and frameworks | ✅ | from your own library | — |
| Workflow, task, agent and tool annotations (§4) | ✅ | from your own library | — |
| Export to Conviva, routed to your project | ✅ | ✅ | — |
| Conversation id on every span | ✅ | ✅ when your library writes one | ✅ from the client sensor |
| Client, conversation and message ids from the client sensor | ✅ with the wiring in §6 | — | ✅ |
| Content capture switch (§8) | ✅ | set in your own library | — |

---

## 2. Quick start — option 1, full SDK

The fastest path: the full SDK with automatic instrumentation. Using
option 2 instead? See §9.

### Prerequisites

| | |
|---|---|
| **Customer key** | Identifies your Conviva account. Traces go to `https://<customer-key>.agw.conviva.com/v1/traces`. |
| **Project id** *(optional)* | Files the traces under a specific project. Without one, they go to your account's default project. |
| **Runtime** | Node.js 20 or later. |

Your Conviva contact provides these values. Keep them in your secret store or
environment, not in source code.

### Install the SDK

```bash
npm install @convivainc/agent-tracing @opentelemetry/api
```

`@opentelemetry/api` is a peer dependency; make sure your application resolves
a single copy of it.

### Configure

```bash
export CONVIVA_CUSTOMER_KEY=<customer-key>
export CONVIVA_PROJECT_ID=<project-id>   # optional
```

### Initialize

Call `init()` once, at startup, **before** you import the LLM SDKs and
frameworks you want traced. Libraries are instrumented as they are loaded, so
anything imported earlier is not traced.

```ts
// tracing.ts — load this module first
import { init } from "@convivainc/agent-tracing";

init({ appName: "travel-assistant" });
```

```ts
// server.ts
import "./tracing";                   // first
const { OpenAI } = require("openai"); // instrumented libraries after it
```

With ES modules, put everything that imports an instrumented library in a
module imported after `./tracing`, start Node with
`--require ./dist/tracing.js`, or pass the libraries explicitly (§3).

That's it. Every supported LLM, vector-database and framework call is now
traced and exported to Conviva. Long-running services need nothing else;
scripts and serverless functions should [flush before exit](#flush-before-exit).

---

## 3. Supported integrations

These libraries are instrumented automatically after `init()` — no code
changes. Each model call records the model, request parameters, prompts and
completions, token usage, and finish reasons.

### LLM providers

| Provider | npm package | |
|---|---|:---:|
| OpenAI and Azure OpenAI (including OpenAI-compatible endpoints) | `openai` | ✅ |
| Anthropic | `@anthropic-ai/sdk` | ✅ |
| AWS Bedrock | `@aws-sdk/client-bedrock-runtime` | ✅ |
| Google Vertex AI | `@google-cloud/vertexai`, `@google-cloud/aiplatform` | ✅ |
| Google Gemini (Gen AI SDK) | `@google/genai` | ✅ |
| Cohere | `cohere-ai` | ✅ |
| Together AI | `together-ai` | ✅ |

### Vector databases

| Database | npm package | |
|---|---|:---:|
| Pinecone | `@pinecone-database/pinecone` | ✅ |
| Chroma | `chromadb` | ✅ |
| Qdrant | `@qdrant/js-client-rest` | ✅ |

### Agent frameworks

| Framework | npm package | |
|---|---|:---:|
| LangChain and LangGraph | `langchain`, `@langchain/*` | ✅ |
| LlamaIndex | `llamaindex` | ✅ |

### Protocols

| Protocol | npm package | |
|---|---|:---:|
| Model Context Protocol (MCP) | `@modelcontextprotocol/sdk` | ✅ |

Something missing? Any library that emits OpenTelemetry spans is exported as
well, and you can trace your own steps with the APIs in §4 and §7.

### Choosing what is instrumented

Pass the modules explicitly. This also makes instrumentation work when your
bundler or ES-module setup loads them before `init()`:

```ts
import OpenAI from "openai";
import * as LlamaIndex from "llamaindex";
import { init } from "@convivainc/agent-tracing";

init({
  appName: "travel-assistant",
  instrumentModules: { openAI: OpenAI, llamaIndex: LlamaIndex },
});
```

Supported keys: `openAI`, `anthropic`, `cohere`, `bedrock`, `google_vertexai`,
`google_aiplatform`, `google_genai`, `together`, `langchain`, `llamaIndex`,
`pinecone`, `chromadb`, `qdrant`, `mcp`.

---

## 4. Tracing workflows, tasks, agents and tools

Auto-instrumentation records each model call on its own. To see the structure
of your agent — which user request a call belongs to, which tool ran, which
sub-agent handled it — annotate your own code. Spans nest automatically.

| Kind | Use it for |
|---|---|
| **workflow** | One end-to-end operation, usually a user turn |
| **task** | A step inside a workflow (retrieval, parsing, a chain) |
| **agent** | An autonomous component that decides what to do |
| **tool** | A function an agent or model calls |

The function's inputs and outputs are recorded on the span (see §8 to turn
that off).

### Wrapper functions

```ts
import { withAgent, withTask, withTool, withWorkflow } from "@convivainc/agent-tracing";

async function chatTurn(message: string): Promise<string> {
  return withWorkflow({ name: "chat_turn" }, () =>
    withAgent({ name: "booking_agent" }, async () => {
      const flights = await withTool({ name: "search_flights" }, () =>
        inventory.search("BLR", "GOI"),
      );
      const ranked = await withTask({ name: "rank_results" }, () => rank(flights));
      return llmSummarise(message, ranked);
    }),
  );
}
```

### Class decorators

```ts
import { agent, tool, workflow } from "@convivainc/agent-tracing";

class BookingAgent {
  @tool({ name: "search_flights" })
  async searchFlights(origin: string, destination: string) {
    return inventory.search(origin, destination);
  }

  @workflow({ name: "chat_turn" })
  async chatTurn(message: string) {
    return llmSummarise(message, await this.searchFlights("BLR", "GOI"));
  }
}
```

Decorators need `"experimentalDecorators": true` in `tsconfig.json`.

---

## 5. Conversations and association properties

Conviva groups traces into conversations so a multi-turn chat reads as one
story. Give each turn its conversation id in **one** of these ways.

### A — let the Conviva client sensor provide it (no code)

If your front end runs the Conviva client sensor, its conversation id arrives
with every request. Complete [§6](#6-connecting-the-conviva-client-sensor--option-3) and
nothing else is needed.

### B — set it in code

```ts
import { withConversation, withWorkflow } from "@convivainc/agent-tracing";

const reply = await withConversation(conversationId, () =>
  withWorkflow({ name: "chat_turn" }, () => agent.run(message)),
);
```

An id you set in code wins over the client sensor's.

### Association properties

Attach your own identifiers — user, tenant, plan — to every span in a scope,
so you can filter on them in Conviva:

```ts
import { withAssociationProperties } from "@convivainc/agent-tracing";

await withAssociationProperties({ user_id: user.id, tenant: "acme" }, () => chatTurn(message));
```

For values that are the same on every span — environment, region,
deployment — use the `attributes` option of `init()` instead.

---

## 6. Connecting the Conviva client sensor — option 3

With option 1, the traces connector is already installed; with option 2, add
it as shown in §9. Either way, the steps below are what get the client
sensor's ids to it.

This is what joins an end-user's session in Conviva to the agent work it
caused. With each request to your backend, the client sensor sends three ids
as a W3C `baggage` header:

```text
baggage: c3.client_id=<id>,c3.conv_id=<id>,c3.msg_id=<id>
```

The SDK copies `c3.client_id`, `c3.conv_id` and `c3.msg_id` onto every span,
and uses `c3.conv_id` as the conversation id when you have not set one. Three
things must hold for the ids to arrive.

**1. Your API accepts the header.** If the front end calls your API on another
origin, allow the header in CORS — otherwise the browser drops it silently:

```text
Access-Control-Allow-Headers: content-type, baggage
```

**2. The header is read into the trace context.** OpenTelemetry HTTP server
instrumentation (`@opentelemetry/instrumentation-http`) does this. If your
server has none, extract it per request:

```ts
// Express
import { context, propagation } from "@opentelemetry/api";

app.use((req, _res, next) => {
  context.with(propagation.extract(context.active(), req.headers), next);
});
```

**3. WebSockets carry it in the message.** Browsers cannot set headers on a
WebSocket. Send the same `baggage` value inside each message and extract it
around that message's handler:

```ts
const ctx = propagation.extract(context.active(), { baggage: message.baggage });
await context.with(ctx, () => handleMessage(message));
```

Calls from your backend to other instrumented services forward the baggage, so
their spans carry the same ids.

To copy additional baggage keys onto spans:

```ts
init({ baggage: { allowlist: ["c3.", "tenant"] } });
```

An entry ending in `.` matches a prefix; any other entry matches exactly.

---

## 7. Manual LLM and vector-database instrumentation

For a model or database client that is not in §3 — an in-house gateway, a raw
HTTP call — report the call yourself.

```ts
import { withLLMCall } from "@convivainc/agent-tracing";

const reply = await withLLMCall({ vendor: "my-gateway", type: "chat" }, async ({ span }) => {
  span.reportRequest({ model: "my-model", messages });
  const response = await gateway.chat({ model: "my-model", messages });
  span.reportResponse({
    model: response.model,
    usage: {
      prompt_tokens: response.usage.input,
      completion_tokens: response.usage.output,
      total_tokens: response.usage.input + response.usage.output,
    },
    completions: [{ finish_reason: "stop", message: { role: "assistant", content: response.text } }],
  });
  return response.text;
});
```

`withVectorDBCall({ vendor, type }, ({ span }) => ...)` does the same for a
vector query.

Messages you report this way are recorded as given, whatever the content
setting in §8. When content is off, report the model and usage only.

---

## 8. Privacy: prompts and completions

By default, prompts, completions, and the inputs and outputs of workflows,
tasks, agents and tools are recorded on spans. They are most of what makes an
agent trace useful — and they may contain personal data.

To keep content off spans, while still recording model, timing, token usage
and structure:

```bash
export CONVIVA_TRACE_CONTENT=false
```

or in code: `init({ traceContent: false })`.

Other points:

- Only allow-listed baggage (`c3.*` by default) is copied onto spans.
- Your customer key is used only in the endpoint host name. It is never sent as
  a header or an attribute.
- There is no automatic PII masking. Redact sensitive values before they reach
  the model, or turn content off. See also [Limitations](#13-limitations).

---

## 9. Exporter only — option 2

Already tracing with an OpenTelemetry-based library — Langfuse, OpenInference,
Arize, or spans you create yourself? Keep it. Add the Conviva exporter and span
processors to the tracer provider you already have, and those spans go to
Conviva. `init()` is not used.

### Install

```bash
npm install @convivainc/otlp-exporter
```

Configure with the same environment variables as option 1
(`CONVIVA_CUSTOMER_KEY`, and optionally `CONVIVA_PROJECT_ID`).

### Wire it in

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  createConvivaSpanProcessors,
  createTraceExporter,
  resolveConfig,
} from "@convivainc/otlp-exporter";

const config = resolveConfig(); // CONVIVA_CUSTOMER_KEY, and optionally CONVIVA_PROJECT_ID

new NodeSDK({
  serviceName: "travel-assistant",
  spanProcessors: [
    ...createConvivaSpanProcessors(config),
    new BatchSpanProcessor(createTraceExporter(config)),
  ],
}).start();
```

If your library builds its own provider and accepts only one span processor,
wrap the stack:
`new CompositeSpanProcessor(...createConvivaSpanProcessors(config), exportingProcessor)`.

The Conviva processors add your project id and the conversation id to every
span. The conversation id is read from what your library already writes —
`gen_ai.conversation.id` or `session.id` — or, with option 3, from the client
sensor.

### Adding the traces connector — option 2 + 3

Install the connector and put its span processor **first**, ahead of the
Conviva processors, so the client sensor's ids are on each span before the
conversation id is resolved.

```bash
npm install @convivainc/agent-traces-connector
```

```ts
import { BaggageSpanProcessor } from "@convivainc/agent-traces-connector";

new NodeSDK({
  serviceName: "travel-assistant",
  spanProcessors: [
    new BaggageSpanProcessor(),
    ...createConvivaSpanProcessors(config),
    new BatchSpanProcessor(createTraceExporter(config)),
  ],
}).start();
```

Then make sure the client sensor's header reaches your agent: §6.

---

## 10. Configuration reference

### `init()` options

| Option | Default | Description |
|---|---|---|
| `appName` | `OTEL_SERVICE_NAME`, else the package name | Service name on every span |
| `customerKey` | `CONVIVA_CUSTOMER_KEY` | Your customer key |
| `projectId` | `CONVIVA_PROJECT_ID` | Your project id. Optional: without it, traces go to your account's default project |
| `endpoint` | `https://<customer-key>.agw.conviva.com` | Send traces somewhere else, e.g. a local collector |
| `headers` | — | Extra export request headers |
| `attributes` | — | Attributes added to every span |
| `traceContent` | `true` | Record prompts, completions and payloads (§8) |
| `disableBatch` | `false` | Export each span as it ends; for scripts and debugging |
| `spanProcessors` | — | Your own span processors, run after Conviva's |
| `baggage` | `c3.*` | Which baggage entries are copied onto spans (§6) |
| `conversationId` | — | `{ conversationId?, sourceAttributes?, baggageKeys? }`: a fixed conversation id, or other attribute / baggage names to read it from |
| `instrumentModules` | all installed | What is auto-instrumented (§3) |
| `propagator` | W3C trace context + baggage | Context propagation format |
| `logLevel` | — | SDK diagnostic logging: `debug`, `info`, `warn`, `error` |

`init()` throws `ConvivaTracingError` when there is neither a valid customer
key nor an endpoint. It does so before changing any global state.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CONVIVA_CUSTOMER_KEY` | — | Customer key. Required unless an endpoint is set. |
| `CONVIVA_PROJECT_ID` | your account's default project | Project id. Optional. |
| `CONVIVA_OTLP_ENDPOINT` | derived | Endpoint override. |
| `CONVIVA_TRACE_CONTENT` | `true` | `false` keeps prompts, completions and payloads off spans. |
| `CONVIVA_ENRICH_TOKENS` | `true` | `false` stops client-side token estimation for models the estimator does not recognise. |
| `OTEL_SERVICE_NAME` | — | Service name when none is passed. |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Standard OpenTelemetry endpoint overrides, honoured after `CONVIVA_OTLP_ENDPOINT`. |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | Extra export request headers, e.g. for a proxy. |

Explicit `init()` options win over environment variables.

### Attributes added to every span

| Attribute | Value |
|---|---|
| `cnv.project_id` | Your project id, when one is configured |
| `cvx.conversation_id`, `gen_ai.conversation.id` | The conversation id (§5) |
| `c3.client_id`, `c3.conv_id`, `c3.msg_id` | The client sensor's ids, when present (§6) |

---

## 11. API reference

### `@convivainc/agent-tracing`

| API | Description |
|---|---|
| `init(options?) → ResolvedConfig` | Start tracing. A second call logs a warning and returns the first configuration. |
| `forceFlush() → Promise<void>` | Export everything still buffered. |
| `shutdown() → Promise<void>` | Flush before the process exits. |
| `getConfig() → ResolvedConfig \| undefined` | The active configuration. |
| `withWorkflow`, `withTask`, `withAgent`, `withTool` `(config, fn, ...args)` | Run `fn` inside a span of that kind. `config`: `{ name, version?, associationProperties?, inputParameters?, suppressTracing? }`. |
| `workflow`, `task`, `agent`, `tool` `(config)` | Method decorators equivalent to the above. |
| `withConversation(conversationId, fn)`, `conversation(id)` | Run `fn` with a conversation id. |
| `withAssociationProperties(properties, fn)` | Attach properties to every span inside `fn`. |
| `withLLMCall`, `LLMSpan` | Manual LLM call span (§7). |
| `withVectorDBCall`, `VectorSpan` | Manual vector-database span (§7). |
| `getTracer()` | An OpenTelemetry tracer for fully custom spans. |
| `BaggageSpanProcessor`, `ensureBaggagePropagator` | The traces connector, re-exported. |
| `ConvivaTracingError` | Thrown for invalid configuration. |

### `@convivainc/otlp-exporter` and `@convivainc/agent-traces-connector` — options 2 and 3

| API | Description |
|---|---|
| `resolveConfig(options?)` | Reads the customer key, optional project id and endpoint. Throws `ConvivaTracingError` on invalid configuration. |
| `createTraceExporter(config)` | The OTLP exporter for Conviva. |
| `createConvivaSpanProcessors(config, options?)` | The span processors that add the conversation id, project id and your own attributes, in the order they must run. |
| `CompositeSpanProcessor(...processors)` | Runs several processors as one, for libraries that accept a single processor. |
| `BaggageSpanProcessor(config?)` | The traces connector: copies the client sensor's ids onto every span. Add it first. |

### Flush before exit

Spans are exported in batches in the background. Before a script, batch job or
serverless function returns:

```ts
await forceFlush();
```

---

## 12. Verifying your integration

1. **Locally first.** Run an OpenTelemetry collector or Jaeger all-in-one
   (OTLP on port 4318) and set `CONVIVA_OTLP_ENDPOINT=http://localhost:4318`.
2. Send one request with a test header:
   `baggage: c3.client_id=test,c3.conv_id=test-conv,c3.msg_id=test-conv:1`.
3. Check the trace:
   - LLM spans show the model, messages and token usage;
   - every span carries `cvx.conversation_id`, `gen_ai.conversation.id`,
     the three `c3.*` ids, and `cnv.project_id` if you set a project id.
4. Remove `CONVIVA_OTLP_ENDPOINT` and run again. The traces appear in your
   Conviva project — or your account's default project if you set none.

Export failures are silent by default. While integrating, turn on logging:

```ts
init({ appName: "travel-assistant", logLevel: "info" });
```

---

## 13. Limitations

| Limitation | What to do |
|---|---|
| **Initialize first.** Libraries imported before `init()` are not traced. | Call `init()` at the very top of your entry point. |
| **ES modules.** Automatic instrumentation hooks the CommonJS loader. | Load the tracing module first with `node --require`, or pass libraries via `instrumentModules`. |
| **One `init()` per process.** Configuration cannot change after start-up. | Configure once, at startup. |
| **`shutdown()` only flushes.** Instrumentation stays installed; tracing cannot be restarted in the same process. | Treat tracing as process-lifetime. |
| **Every span is exported**, including HTTP and database spans from other OpenTelemetry instrumentation in the process. | Use §9 with your own filtering processor. |
| **Content is on by default**, and the LangChain / LangGraph integration may record message content even with `CONVIVA_TRACE_CONTENT=false`. | Redact before the model call, and verify what your setup records (§12). |
| **No automatic PII masking.** | Redact sensitive values in your code, or turn content off. |
| **Streaming token usage.** Some providers report usage on streamed responses only when asked (for example OpenAI's `stream_options: { include_usage: true }`). | Request usage on streamed calls. |
| **Token estimation.** For models the estimator does not recognise, a warning is logged and the estimate is skipped. | Set `CONVIVA_ENRICH_TOKENS=false`; reported usage is still recorded. |
| **No cost attribute.** Spans carry model and token counts, not prices. | Cost is derived from model and token usage. |
| **Traces only.** No metrics or logs are sent to Conviva. | — |
| **Context across process boundaries.** Context follows async code in-process; it does not cross job queues or worker processes by itself. | Propagate it with OpenTelemetry's `propagation.inject` / `extract`. |
| **Custom span post-processing hooks** are not supported. | Use `spanProcessors`. |

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ConvivaTracingError` on start-up | No customer key, or one that is not a valid host name | Check `CONVIVA_CUSTOMER_KEY`. |
| No LLM spans | The library was loaded before `init()` | Initialize first, or pass the library in `instrumentModules`. |
| Spans arrive but are not grouped | No conversation id | §5 B, or connect the client sensor (§6). |
| No `c3.*` attributes | The `baggage` header is blocked by CORS or not extracted | §6 steps 1 and 2. |
| Last spans of a script are missing | The process exited before export | `await forceFlush()`. |
| Traces are not where you expect | No project id, so they went to your account's default project | Set `CONVIVA_PROJECT_ID`. |
| Gateway returns 200 but nothing is visible | Spans lack a conversation id | Verify locally (§12). |
| "Unknown model" warnings | Token estimation for an unrecognised model | `CONVIVA_ENRICH_TOKENS=false`. |
