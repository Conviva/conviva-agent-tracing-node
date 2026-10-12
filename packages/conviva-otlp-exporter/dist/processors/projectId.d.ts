import type { Context } from "@opentelemetry/api";
import type { ReadableSpan, Span, SpanProcessor } from "@opentelemetry/sdk-trace-base";
/**
 * Adds the Conviva project id to every span without overwriting app-owned data.
 *
 * Not redundant with the `X-Conviva-Project-Id` request header: the header plus
 * a resource attribute alone was observed to produce HTTP 200 on every export
 * with nothing visible downstream. Only the per-span attribute worked.
 */
export declare class ProjectIdSpanProcessor implements SpanProcessor {
    private readonly projectId;
    constructor(projectId: string);
    onStart(span: Span, _parentContext: Context): void;
    onEnd(_span: ReadableSpan): void;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
