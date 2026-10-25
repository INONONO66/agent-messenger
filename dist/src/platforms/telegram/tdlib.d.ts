export declare class TdjsonBinding {
    readonly libraryPath: string;
    private symbols;
    private constructor();
    static create(tdlibPath?: string): Promise<TdjsonBinding>;
    createClientId(): number;
    send(clientId: number, query: unknown): void;
    receive(timeoutSeconds: number): Promise<unknown>;
    execute(query: unknown): any | null;
}
//# sourceMappingURL=tdlib.d.ts.map