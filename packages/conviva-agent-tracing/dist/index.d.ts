import { type ConnectorConfig } from "@convivainc/agent-traces-connector";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { type ConversationIdOptions, type ConvivaConfigOptions, type ResolvedConfig } from "@convivainc/otlp-exporter";
import { type InitializeOptions } from "@traceloop/node-server-sdk";
/**
 * Conviva-owned options plus OpenLLMetry's own initialization surface.
 *
 * `baseUrl`, `exporter` and `processor` are removed because this package owns
 * the destination and the processor stack; `gcpProjectId` is removed because it
 * selects a different backend entirely.
 */
export interface ConvivaTracingOptions extends Omit<InitializeOptions, "baseUrl" | "exporter" | "processor" | "gcpProjectId">, ConvivaConfigOptions {
    /**
     * Extra span processors, composed after Conviva's own.
     *
     * Replaces v0.1.0's singular `processor`: Conviva now installs several
     * processors of its own, so the slot has to be a list.
     */
    spanProcessors?: SpanProcessor[];
    /** Tunes how `cvx.conversation_id` is discovered. */
    conversationId?: ConversationIdOptions;
    /** Extra attributes stamped onto every span, e.g. tenant or deployment. */
    attributes?: Record<string, string | undefined>;
    /**
     * Tunes which W3C baggage entries `@convivainc/agent-traces-connector`
     * copies onto every span. Defaults to the Conviva client's `c3.*` entries
     * (client, conversation and message ids).
     */
    baggage?: ConnectorConfig;
}
/** Set to `0`, `false` or `no` to keep prompts and completions off spans. */
export declare const TRACE_CONTENT_ENV = "CONVIVA_TRACE_CONTENT";
/**
 * Set to `false` to stop client-side token estimation for models the
 * estimator does not know (Gemini, Claude, ...), which otherwise logs
 * "Unknown model" on every call. Token usage reported by the model response
 * is recorded either way.
 */
export declare const ENRICH_TOKENS_ENV = "CONVIVA_ENRICH_TOKENS";
/**
 * Initializes Conviva tracing on top of OpenLLMetry.
 *
 * Auto-instruments the LLM, vector-DB and framework libraries OpenLLMetry
 * supports, and exports the resulting spans to the Conviva agent gateway over
 * OTLP http/protobuf, with `cvx.conversation_id` and `cnv.project_id` stamped
 * on every span, along with the Conviva client's `c3.*` baggage entries.
 * Traces only — no metrics or logs are exported.
 *
 * Call once, before importing the libraries you want instrumented.
 *
 * Note that every span on the global tracer provider is exported, including
 * spans from any host HTTP or database instrumentation — OpenLLMetry installs
 * no scope filter.
 *
 * @example
 * ```ts
 * import { init } from "@convivainc/agent-tracing";
 *
 * // Reads CONVIVA_CUSTOMER_KEY and CONVIVA_PROJECT_ID from the environment.
 * init({ appName: "my-agent" });
 * ```
 *
 * @throws {ConvivaTracingError} if neither a customer key nor an endpoint is set, or a value is malformed.
 */
export declare function init(options?: ConvivaTracingOptions): ResolvedConfig;
/** The active configuration, or `undefined` before `init()`. */
export declare function getConfig(): ResolvedConfig | undefined;
/** Flushes any spans still buffered in the batch processor. */
export declare function forceFlush(): Promise<void>;
/**
 * Flushes pending spans before shutdown.
 *
 * OpenLLMetry keeps its `NodeSDK` instance private and exposes no shutdown
 * hook, so this drains the batch processor but leaves instrumentation
 * installed — tracing cannot be restarted in the same process.
 */
export declare function shutdown(): Promise<void>;
/** Test seam: forget the cached config so a fresh `init()` can run. */
export declare function resetForTesting(): void;
/** The Conviva transport layer, re-exported so applications depend on this package alone. */
export { CONVERSATION_ID_ATTRIBUTE, CUSTOMER_KEY_ENV, ENDPOINT_ENV, GATEWAY_DOMAIN, PROJECT_ID_ATTRIBUTE, PROJECT_ID_ENV, PROJECT_ID_HEADER, TRACES_PATH, ASSOCIATION_PROPERTY_PREFIX, AttributeSpanProcessor, CompositeSpanProcessor, ConversationIdSpanProcessor, ConvivaTracingError, DEFAULT_BAGGAGE_KEYS, DEFAULT_SOURCE_ATTRIBUTES, GEN_AI_CONVERSATION_ID_ATTRIBUTE, ProjectIdSpanProcessor, createConvivaSpanProcessors, createTraceExporter, resolveConfig, type ConversationIdOptions, type ResolvedConfig, } from "@convivainc/otlp-exporter";
/** The baggage connector, re-exported so applications depend on this package alone. */
export { BaggageSpanProcessor, ensureBaggagePropagator, type ConnectorConfig, } from "@convivainc/agent-traces-connector";
/**
 * OpenLLMetry's manual-annotation surface, re-exported so applications depend
 * on this package alone.
 */
export { AssociationProperty, LLMSpan, VectorSpan, agent, conversation, getTraceloopTracer as getTracer, task, tool, withAgent, withAssociationProperties, withConversation, withLLMCall, withTask, withTool, withVectorDBCall, withWorkflow, workflow, type DecoratorConfig, } from "@traceloop/node-server-sdk";
