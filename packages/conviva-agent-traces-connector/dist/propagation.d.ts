/**
 * Ensure the global propagator composes W3C trace context + baggage so that
 * incoming `baggage:` headers are parsed and outbound HTTP calls re-inject
 * baggage (assuming the host app has otel HTTP instrumentation).
 *
 * NOTE: the OTel API does not expose reading the current propagator's children,
 * so the simplest correct behavior is to set a composite of the two standard
 * propagators. If the host app already registered a custom propagator that it
 * wants to keep, it should build and set its own composite (including these two)
 * instead of relying on this helper. For the sample app, this default is what
 * we want.
 */
export declare function ensureBaggagePropagator(): void;
