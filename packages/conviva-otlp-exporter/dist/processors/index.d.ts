import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { ResolvedConfig } from "../config";
import { type ConversationIdOptions } from "./conversation";
export { AttributeSpanProcessor } from "./attributes";
export { ASSOCIATION_PROPERTY_PREFIX, ConversationIdSpanProcessor, DEFAULT_BAGGAGE_KEYS, DEFAULT_SOURCE_ATTRIBUTES, GEN_AI_CONVERSATION_ID_ATTRIBUTE, type ConversationIdOptions, } from "./conversation";
export { CompositeSpanProcessor } from "./composite";
export { ProjectIdSpanProcessor } from "./projectId";
export interface ConvivaSpanProcessorOptions {
    conversationId?: ConversationIdOptions;
    /** Extra attributes stamped onto every span, e.g. tenant or deployment. */
    attributes?: Record<string, string | undefined>;
}
/**
 * The full Conviva processor stack, in the order it must run.
 *
 * Conversation first so `cvx.conversation_id` is resolved from whatever the
 * instrumentation wrote; project id next; caller attributes last, since they
 * are the most specific.
 *
 * Returned as an array rather than a composite so callers that own a
 * `NodeSDK` can pass them straight to `spanProcessors`. Callers stuck with a
 * single-processor API wrap them in {@link CompositeSpanProcessor}.
 */
export declare function createConvivaSpanProcessors(config: ResolvedConfig, options?: ConvivaSpanProcessorOptions): SpanProcessor[];
