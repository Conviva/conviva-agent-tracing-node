# Conviva agent tracing for Node.js

Trace AI agents built on Node.js and send the traces to Conviva.

| Package | Use it for |
|---|---|
| [`@convivainc/agent-tracing`](https://www.npmjs.com/package/@convivainc/agent-tracing) | Full SDK: auto-instrumentation and export in one `init()` |
| [`@convivainc/otlp-exporter`](https://www.npmjs.com/package/@convivainc/otlp-exporter) | Exporter only, for apps that already produce OpenTelemetry spans |
| [`@convivainc/agent-traces-connector`](https://www.npmjs.com/package/@convivainc/agent-traces-connector) | Links agent spans to the Conviva client sensor's conversation ids; use with either of the above |

```bash
# Full SDK
npm install @convivainc/agent-tracing @opentelemetry/api

# Exporter only
npm install @convivainc/otlp-exporter

# Add the traces connector to either
npm install @convivainc/agent-traces-connector
```

See the [integration guide](INTEGRATION_GUIDE.md) for setup, configuration and
the full API.

## About this repository

It holds the published packages only (`packages/`), not their source. Releases
are published to npm from here by the **Publish** workflow when a GitHub
release is created.
