export declare class EventQueue<T> implements AsyncIterable<T> {
    private values;
    private pending;
    private closed;
    push(value: T): void;
    end(): void;
    [Symbol.asyncIterator](): AsyncIterator<T>;
}
//# sourceMappingURL=event-queue.d.ts.map