import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import type { ResolvedConfig } from "../config";
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
 */
export declare function createTraceExporter(config: ResolvedConfig): OTLPTraceExporter;
