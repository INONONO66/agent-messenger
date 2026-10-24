export type CliResult = {
    error?: string;
} & Record<string, unknown>;
export declare function cliOutput<T extends {
    error?: string;
}>(result: T, pretty?: boolean, exitOnError?: boolean): void;
//# sourceMappingURL=cli-output.d.ts.map