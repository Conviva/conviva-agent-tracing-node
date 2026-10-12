export declare const CUSTOMER_KEY_ENV = "CONVIVA_CUSTOMER_KEY";
export declare const PROJECT_ID_ENV = "CONVIVA_PROJECT_ID";
export declare const ENDPOINT_ENV = "CONVIVA_OTLP_ENDPOINT";
/** Header the Conviva gateway routes an export to a project by. */
export declare const PROJECT_ID_HEADER = "X-Conviva-Project-Id";
/** Attribute carrying the same project id inside the telemetry payload. */
export declare const PROJECT_ID_ATTRIBUTE = "cnv.project_id";
/** Attribute carrying the conversation id inside the telemetry payload. */
export declare const CONVERSATION_ID_ATTRIBUTE = "cvx.conversation_id";
export declare const GATEWAY_DOMAIN = "agw.conviva.com";
export declare const TRACES_PATH = "/v1/traces";
/**
 * Not exported from the package: only traces are sent. Kept so an endpoint
 * copied from a generic OTLP setup (`.../v1/metrics`) still resolves to the
 * right base URL, and so the cross-language contract can assert them.
 */
export declare const METRICS_PATH = "/v1/metrics";
export declare const LOGS_PATH = "/v1/logs";
/**
 * Configuration owned by Conviva.
 *
 * Deliberately free of any OpenTelemetry SDK type: this package is the
 * transport layer and must stay installable without `@opentelemetry/sdk-node`.
 * The wrapper SDKs extend this with their own framework options.
 */
export interface ConvivaConfigOptions {
    /** Becomes the `<customerKey>.agw.conviva.com` subdomain. */
    customerKey?: string;
    /**
     * Sent as the `X-Conviva-Project-Id` header and the `cnv.project_id`
     * attribute. Optional: without one, the gateway files the customer's traces
     * under its default project.
     */
    projectId?: string;
    /** OTLP HTTP base URL, or a full signal URL such as `.../v1/traces`. */
    endpoint?: string;
    /** Additional OTLP request headers. The project routing header cannot be overridden. */
    headers?: Record<string, string>;
}
export interface ResolvedConfig {
    customerKey?: string;
    /** Absent when none was configured: the gateway then uses the default project. */
    projectId?: string;
    /** Base URL: no trailing slash, no signal path. */
    endpoint: string;
    tracesUrl: string;
    headers: Record<string, string>;
}
/** Parse the OTLP `key=value,key=value` environment-variable format. */
export declare function parseKeyPairs(raw: string): Record<string, string>;
/**
 * Resolve the Conviva destination and routing headers.
 *
 * Endpoint precedence, highest first:
 *   1. `options.endpoint`
 *   2. `CONVIVA_OTLP_ENDPOINT`
 *   3. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
 *   4. `OTEL_EXPORTER_OTLP_ENDPOINT`
 *   5. derived — `https://<customerKey>.agw.conviva.com`
 *
 * Rungs 3 and 4 are what let a stock OpenTelemetry operator redirect telemetry
 * to a local collector without knowing any Conviva-specific variable name.
 */
export declare function resolveConfig(options?: ConvivaConfigOptions, env?: NodeJS.ProcessEnv): ResolvedConfig;
