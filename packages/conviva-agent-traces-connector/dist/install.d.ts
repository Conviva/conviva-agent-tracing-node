import { ConnectorConfig } from './config';
import { BaggageSpanProcessor } from './processor';
interface InstallOptions {
    tracerProvider?: any;
    config?: ConnectorConfig;
}
/**
 * Attach a {@link BaggageSpanProcessor} and register the baggage propagator.
 *
 * Idempotent: repeated calls against the same provider return the existing
 * processor rather than adding a second one. Providers that do not support
 * `addSpanProcessor` (e.g. the API's no-op / proxy provider) are handled
 * gracefully; the propagator is still registered.
 *
 * OpenTelemetry JS SDK 2.x providers no longer expose `addSpanProcessor` —
 * they take processors in their constructor. With those, pass
 * `new BaggageSpanProcessor()` in the provider's `spanProcessors` option
 * instead; `@convivainc/agent-tracing` does this for you.
 */
export declare function install(options?: InstallOptions): BaggageSpanProcessor | undefined;
export {};
