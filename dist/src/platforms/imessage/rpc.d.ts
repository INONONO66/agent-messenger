type MessageHandler = (message: unknown) => void;
type ErrorHandler = (message: string) => void;
export declare class ImsgRpc {
    private child;
    private reader;
    private nextId;
    private pending;
    private subscriptions;
    private stderrBuffer;
    start(binaryPath?: string): Promise<void>;
    private spawnError;
    private handleLine;
    private handleExit;
    request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
    subscribe(params: Record<string, unknown>, onMessage: MessageHandler, onError?: ErrorHandler): Promise<number>;
    unsubscribe(subscription: number): Promise<void>;
    close(): void;
}
export {};
//# sourceMappingURL=rpc.d.ts.map