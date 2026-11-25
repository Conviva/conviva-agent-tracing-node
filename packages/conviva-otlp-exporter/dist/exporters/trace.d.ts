import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ResolvedConfig } from "../config";
import { type MaskFunction } from "./mask";
export interface TraceExporterOptions {
    /**
     * Optional hook called for each content attribute just before export. Off
     * when absent: the plain OTLP exporter is returned.
     */
    mask?: MaskFunction;
    /**
     * Extra attribute names to pass to `mask`, beyond the built-in content keys
     * (see `MaskingOptions.attributes`). Requires `mask`.
     */
    maskAttributes?: readonly string[];
}
/**
 * Builds the OTLP **http/protobuf** trace exporter pointed at the Conviva
 * gateway, with the `X-Conviva-Project-Id` header on every request.
 *
 * The exporter is constructed here rather than delegated to a vendor SDK so the
 * destination, protocol and routing header are all Conviva-owned. Vendor SDKs
 * create ordinary OpenTelemetry spans and do not need their own exporter.
 *
 * `url` is passed explicitly and therefore wins over the `OTEL_EXPORTER_OTLP_*`
 * endpoint variables, which could otherwise redirect traces off the gateway
 * after config resolution has already decided where they go.
 *
 * With `options.mask`, the exporter is wrapped in a {@link MaskingSpanExporter}.
 * Without it, the return type is unchanged from 1.0.0.
 */
export declare function createTraceExporter(config: ResolvedConfig, options?: TraceExporterOptions & {
    mask?: undefined;
    maskAttributes?: undefined;
}): OTLPTraceExporter;
export declare function createTraceExporter(config: ResolvedConfig, options: TraceExporterOptions): SpanExporter;
