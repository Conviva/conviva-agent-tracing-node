import type { Context } from "@opentelemetry/api";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
/**
 * Stamps a fixed set of attributes onto every span.
 *
 * Generalization of the per-sample tenant processors: `undefined` and empty
 * values are dropped once at construction rather than re-checked per span, so
 * the hot path is a single `setAttributes` call.
 */
export declare class AttributeSpanProcessor implements SpanProcessor {
    private readonly attributes;
    private readonly empty;
    constructor(attributes: Record<string, string | undefined>);
    onStart(span: Span, _parentContext: Context): void;
    onEnd(_span: ReadableSpan): void;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
