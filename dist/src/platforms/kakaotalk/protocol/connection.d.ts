import { type ConnectionOptions } from 'node:tls';
import type { LocoPacket } from './types.js';
export declare class LocoPacketTimeoutError extends Error {
    readonly method: string;
    readonly written: boolean;
    constructor(method: string, written: boolean);
}
export declare class LocoConnection {
    private socket;
    private crypto;
    private buffer;
    private decryptedBuffer;
    private packetIdCounter;
    private pendingResolvers;
    private timedOutIds;
    private pushHandler;
    private closeHandler;
    connectTls(host: string, port: number, options?: ConnectionOptions): Promise<void>;
    connectSecure(host: string, port: number): Promise<void>;
    private performHandshake;
    writeRaw(data: Buffer): Promise<void>;
    sendPacket(method: string, body?: Record<string, unknown>): Promise<LocoPacket>;
    onPush(handler: (packet: LocoPacket) => void): void;
    onClose(handler: () => void): void;
    close(): void;
    private write;
    private onData;
    private processBuffer;
    private dispatchPacket;
    private handleClose;
}
//# sourceMappingURL=connection.d.ts.map