/**
 * `@convivainc/otlp-exporter` — the Conviva transport layer.
 *
 * Resolves the gateway destination and routing headers, builds the OTLP
 * http/protobuf trace exporter, and supplies the span processors that stamp the
 * project and conversation ids the gateway correlates on.
 *
 * Traces only: the gateway serves `/v1/traces`, and nothing here exports
 * metrics or logs.
 *
 * Depends on no vendor SDK — no OpenLLMetry, no Langfuse — so it can be used
 * on its own underneath whichever instrumentation library an application
 * already has.
 */
export { CONVERSATION_ID_ATTRIBUTE, CUSTOMER_KEY_ENV, ENDPOINT_ENV, GATEWAY_DOMAIN, PROJECT_ID_ATTRIBUTE, PROJECT_ID_ENV, PROJECT_ID_HEADER, TRACES_PATH, parseKeyPairs, resolveConfig, type ConvivaConfigOptions, type ResolvedConfig, } from "./config";
export { ConvivaTracingError } from "./errors";
export { createTraceExporter, type TraceExporterOptions } from "./exporters/trace";
export { MASK_CONTENT_KEYS, MASK_CONTENT_PREFIXES, MASK_NEVER_KEYS, MaskingSpanExporter, STATUS_DESCRIPTION_KEY, isMaskableAttribute, type MaskFunction, type MaskInput, type MaskingOptions, } from "./exporters/mask";
export { ASSOCIATION_PROPERTY_PREFIX, AttributeSpanProcessor, CompositeSpanProcessor, ConversationIdSpanProcessor, DEFAULT_BAGGAGE_KEYS, DEFAULT_SOURCE_ATTRIBUTES, GEN_AI_CONVERSATION_ID_ATTRIBUTE, ProjectIdSpanProcessor, createConvivaSpanProcessors, type ConversationIdOptions, type ConvivaSpanProcessorOptions, } from "./processors";
