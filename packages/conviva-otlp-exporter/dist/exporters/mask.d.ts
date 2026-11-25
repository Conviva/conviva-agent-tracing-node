/**
 * The optional mask hook.
 *
 * The SDK does not detect or mask PII itself: detection runs once, centrally,
 * in the Conviva pipeline, where every ingest path is covered and rules change
 * without a customer upgrade. What the SDK offers is a hook — a function the
 * application writes (regex, Presidio, its own DLP) that is called for each
 * content attribute on every finished span, and on each of its events, just
 * before export.
 *
 * Off unless a function is passed: without one, no wrapper is installed and
 * spans are exported exactly as before.
 *
 * WHY AN EXPORTER WRAPPER and not a span processor: by the time a span reaches
 * the exporter its attributes are final, including the ones OpenLLMetry writes
 * late in `onEnd`. Spans are not mutated in place — a copy carrying the masked
 * attributes is exported, so other processors and exporters see the original.
 */
import { type AttributeValue } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
/** The key the span's status description is passed to the hook under. */
export declare const STATUS_DESCRIPTION_KEY = "otel.status_description";
/**
 * Exact attribute names that carry prompt, completion, tool or error content.
 * Matched on span attributes and on span-event attributes alike.
 */
export declare const MASK_CONTENT_KEYS: readonly string[];
/** Attribute-name prefixes that carry content (OpenLLMetry's indexed and association attributes). */
export declare const MASK_CONTENT_PREFIXES: readonly string[];
/**
 * Never passed to the hook, even when a prefix matches: Conviva groups spans
 * into conversations by these, so a hook that rewrote them would split or
 * merge conversations.
 */
export declare const MASK_NEVER_KEYS: readonly string[];
/**
 * Whether the mask hook is called for an attribute (on a span or a span event).
 *
 * `extraAttributes` adds names beyond the built-in content keys, in the
 * `maskAttributes` syntax (exact names, or a prefix ending in `*`). The
 * conversation ids in {@link MASK_NEVER_KEYS} are never maskable.
 */
export declare function isMaskableAttribute(key: string, extraAttributes?: readonly string[]): boolean;
export interface MaskInput {
    /** The attribute name, e.g. `gen_ai.input.messages`. */
    readonly key: string;
    /** The attribute value as recorded. Usually a string, often JSON. */
    readonly value: AttributeValue;
    /**
     * The finished span, as it was recorded. A read-only view: its attributes
     * and events are frozen copies. Do not try to modify it.
     */
    readonly span: ReadableSpan;
    /**
     * The name of the span event the attribute belongs to (e.g. `exception`),
     * or `undefined` for an attribute of the span itself.
     */
    readonly event?: string;
}
/**
 * Returns the value to export in place of `value`, or `undefined` to drop the
 * attribute. Must be synchronous and return a valid attribute value (string,
 * number, boolean, or a homogeneous array of one of those). Called on the
 * export path, so keep it fast.
 */
export type MaskFunction = (input: MaskInput) => AttributeValue | undefined;
export interface MaskingOptions {
    /**
     * Extra attribute names to pass to the hook, for instrumentation that
     * records content outside the built-in keys -- e.g. OpenInference's
     * `input.value` / `output.value`. An entry ending in `*` is a prefix
     * (`"langfuse.observation.*"`); any other entry is an exact name. Adds to the
     * built-in keys, never replaces them; conversation ids stay unmaskable.
     */
    attributes?: readonly string[];
}
/** Wraps an exporter so every span passes through `mask` before it is sent. */
export declare class MaskingSpanExporter implements SpanExporter {
    private readonly delegate;
    private readonly mask;
    private readonly isExtra;
    private nextWarnAt;
    private suppressed;
    /**
     * @throws ConvivaTracingError if `mask` is not a synchronous function, or
     * `options.attributes` is not an array of non-empty strings.
     */
    constructor(delegate: SpanExporter, mask: MaskFunction, options?: MaskingOptions);
    /** Whether the hook is called for `key`: built-in content keys plus `options.attributes`. */
    private isMaskable;
    export(spans: ReadableSpan[], resultCallback: Parameters<SpanExporter["export"]>[1]): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
    /** The span to export: `span` itself when the hook changed nothing. */
    private maskSpan;
    /**
     * Calls the hook for one value. Returns {@link UNCHANGED} when the hook gave
     * the value back, otherwise the value to export (`undefined` = drop it).
     * Fails closed: if the hook throws, returns a Promise or returns something
     * that is not an attribute value, the result is `undefined`.
     */
    private applyHook;
    /**
     * Applies the hook to one attribute map. Fails closed: if the hook throws,
     * returns a Promise or returns something that is not an attribute value,
     * that attribute is dropped and the span still exports. Returns `original`
     * when nothing changed, so untouched spans are not copied.
     */
    private maskMap;
    /**
     * Logs a failing hook at most once a minute. Only the attribute key and the
     * error's type are logged — never its message, which may quote the very
     * content the hook was meant to mask.
     */
    private warn;
}
