/**
 * Thrown when the Conviva telemetry configuration is invalid or incomplete.
 *
 * Configuration is resolved eagerly — before any OpenTelemetry global state is
 * registered — so a throw leaves the process untouched.
 */
export declare class ConvivaTracingError extends Error {
    constructor(message: string);
}
