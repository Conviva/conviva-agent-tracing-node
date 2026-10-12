/**
 * Conversation correlation.
 *
 * Conviva groups spans into a conversation by a single attribute,
 * `cvx.conversation_id`. No instrumentation SDK writes that name: OpenLLMetry's
 * `withAssociationProperties({ session_id })` writes
 * `traceloop.association.properties.session_id`, and Langfuse writes
 * `session.id`. This processor closes the gap by copying whichever one is
 * present onto the name Conviva reads.
 *
 * WHY A SPAN PROCESSOR, and why it must run after the SDK's own:
 *
 * OpenLLMetry applies association properties in the `onStart` of its own
 * exporting processor. `initialize()` puts that processor first in the list and
 * appends `options.processor` after it, so by the time this one runs the
 * association property is already on the span and can be read back off it.
 * Reading rather than re-deriving keeps one source of truth — whatever the
 * instrumentation decided the conversation is, that is what Conviva sees.
 *
 * `onStart`, not `onEnd`: by `onEnd` the span is read-only and the exporting
 * processor has already run.
 */
import { type Context } from "@opentelemetry/api";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
/**
 * The OpenTelemetry GenAI semantic-convention name for the conversation id.
 * Written alongside `cvx.conversation_id` so a backend that maps the standard
 * name (to `session_id`, for example) sees the same value.
 */
export declare const GEN_AI_CONVERSATION_ID_ATTRIBUTE = "gen_ai.conversation.id";
/** Prefix OpenLLMetry gives every association property it writes onto a span. */
export declare const ASSOCIATION_PROPERTY_PREFIX = "traceloop.association.properties.";
/**
 * Span attributes read as the conversation id, highest priority first.
 *
 * First entry is OpenLLMetry's association property; the other two are the
 * OpenTelemetry-native spellings that Langfuse and OpenInference emit.
 */
export declare const DEFAULT_SOURCE_ATTRIBUTES: readonly ["traceloop.association.properties.session_id", "session.id", "gen_ai.conversation.id"];
/**
 * Baggage keys read as the conversation id, highest priority first.
 *
 * `c3.conv_id` comes first: it is the conversation id the Conviva client
 * sensor puts in the `baggage` header, the same entry
 * `@convivainc/agent-traces-connector` copies onto spans.
 */
export declare const DEFAULT_BAGGAGE_KEYS: readonly ["c3.conv_id", "conversation_id", "session_id", "langfuse_session_id"];
export interface ConversationIdOptions {
    /** Explicit value; wins over every discovered source. */
    conversationId?: string;
    /** Span attributes to read, in order. Defaults to {@link DEFAULT_SOURCE_ATTRIBUTES}. */
    sourceAttributes?: readonly string[];
    /** Baggage keys to read, in order. Defaults to {@link DEFAULT_BAGGAGE_KEYS}. */
    baggageKeys?: readonly string[];
}
/**
 * Writes `cvx.conversation_id` and `gen_ai.conversation.id` onto every span
 * that can be correlated.
 *
 * Resolution order, first hit wins:
 *   1. the explicit `conversationId` option
 *   2. `sourceAttributes`, read off the span
 *   3. `baggageKeys`, read off the parent context
 *
 * Neither attribute is ever overwritten — an application that set one
 * deliberately has made a more specific statement than anything this
 * processor can infer. An existing `cvx.conversation_id` is also the value
 * used for a missing `gen_ai.conversation.id`, so the two cannot disagree
 * unless the application made them.
 */
export declare class ConversationIdSpanProcessor implements SpanProcessor {
    private readonly conversationId?;
    private readonly sourceAttributes;
    private readonly baggageKeys;
    constructor(options?: ConversationIdOptions);
    onStart(span: Span, parentContext: Context): void;
    private resolve;
    onEnd(_span: ReadableSpan): void;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
