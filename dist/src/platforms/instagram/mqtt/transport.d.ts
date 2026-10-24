export interface MqttPublish {
    topic: string;
    payload: Buffer;
}
export interface MqttTransportEventMap {
    connect: [];
    publish: [MqttPublish];
    error: [Error];
    close: [];
}
type EventKey = keyof MqttTransportEventMap;
export declare class MqttTransport {
    private socket;
    private emitter;
    private buffer;
    private nextPacketId;
    private pingTimer;
    private connackTimer;
    private connackTimeoutMs;
    constructor(options?: {
        connackTimeoutMs?: number;
    });
    connect(connectPayload: Buffer): void;
    publish(topic: string, payload: Buffer, qos?: 0 | 1): void;
    subscribe(topics: string[]): void;
    disconnect(): void;
    on<K extends EventKey>(event: K, listener: (...args: MqttTransportEventMap[K]) => void): this;
    private onData;
    private drainPackets;
    private handlePacket;
    private handlePublish;
    private sendPubAck;
    private startPing;
    private stopPing;
    private clearConnackTimer;
    private buildConnectPacket;
    private buildPublishPacket;
    private buildSubscribePacket;
    private allocatePacketId;
}
export {};
//# sourceMappingURL=transport.d.ts.map