/**
 * Configuration for baggage-to-span-attribute copying.
 *
 * `allowlist` entries are matched two ways:
 *   - an exact match against the baggage key, or
 *   - a prefix match, but only for entries that end in `.` (e.g. `c3.`
 *     matches `c3.client_id` but not `c3client_id`).
 */
export interface ConnectorConfig {
    allowlist?: string[];
    attributePrefix?: string;
    logger?: {
        warn: (msg: string) => void;
    };
}
export declare class Config {
    readonly allowlist: string[];
    readonly attributePrefix: string;
    readonly logger?: {
        warn: (msg: string) => void;
    };
    constructor(cfg?: ConnectorConfig);
    matches(key: string): boolean;
    attrKey(key: string): string;
}
export declare function resolveConfig(cfg?: ConnectorConfig): Config;
export declare const DEFAULT_CONFIG: Config;
