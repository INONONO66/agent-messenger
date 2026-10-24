import { type LocoPacket } from './types.js';
export declare function encodePacket(packet: LocoPacket): Buffer;
export declare function decodePacket(data: Buffer): {
    packet: LocoPacket;
    bytesConsumed: number;
} | null;
//# sourceMappingURL=packet.d.ts.map