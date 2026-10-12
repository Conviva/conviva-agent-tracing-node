import type { Context } from "@opentelemetry/api";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
/**
 * Runs several span processors as one.
 *
 * OpenLLMetry's `initialize()` accepts a single `options.processor`, so this is
 * how Conviva's processors coexist with one the application passed in.
 * Processors run in argument order; `forceFlush` and `shutdown` fan out to all
 * of them. `undefined` entries are dropped so callers can splice in optional
 * processors without a filter at every call site.
 */
export declare class CompositeSpanProcessor implements SpanProcessor {
    private readonly processors;
    constructor(...processors: (SpanProcessor | undefined)[]);
    onStart(span: Span, parentContext: Context): void;
    onEnd(span: ReadableSpan): void;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
