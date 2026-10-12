import { Context } from '@opentelemetry/api';
import { SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Config } from './config';
/**
 * Copies allowlisted W3C baggage entries onto every span at start time.
 */
export declare class BaggageSpanProcessor implements SpanProcessor {
    private readonly config;
    constructor(config?: Config);
    onStart(span: Span, parentContext: Context): void;
    onEnd(): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
